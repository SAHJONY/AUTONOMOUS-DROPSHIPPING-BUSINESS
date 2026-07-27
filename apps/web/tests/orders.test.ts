import { beforeEach, describe, expect, it } from "vitest";
import {
  classifyOrder,
  estimatedCogs,
  findOrderByExternalId,
  ingestShopifyOrder,
  isPaid,
  listOrders,
  mapShopifyOrder,
  matchProduct,
  productPerformance,
  recordRefund,
  saleEntries,
  totalUnits,
  unfulfillableLines,
} from "@/lib/orders";
import { getPnl } from "@/lib/ledger";
import { makeOrder, makeProduct, resetStore, shopifyOrderPayload } from "./helpers";

const ACCEPT = { holdRisky: true, riskRecommendation: "accept" };

describe("matchProduct", () => {
  const products = [
    makeProduct({ id: "a", shopify_variant_id: 111, sku: "SKU-A", title: "Lamp" }),
    makeProduct({ id: "b", shopify_variant_id: 222, sku: "SKU-B", title: "Mug", shopify_id: 999 }),
  ];

  it("prefers the exact variant id", () => {
    expect(matchProduct({ variant_id: 222, sku: "SKU-A" }, products)?.id).toBe("b");
  });

  it("falls back to the product id, then SKU, then title", () => {
    expect(matchProduct({ product_id: 999 }, products)?.id).toBe("b");
    expect(matchProduct({ sku: "sku-a" }, products)?.id).toBe("a");
    expect(matchProduct({ title: "  mug " }, products)?.id).toBe("b");
  });

  it("returns null for a product that was never in our catalog", () => {
    expect(matchProduct({ sku: "SOMETHING-ELSE", title: "Mystery" }, products)).toBeNull();
  });
});

describe("mapShopifyOrder", () => {
  const products = [makeProduct()];

  it("maps money, customer, address, and lines off a real payload shape", () => {
    const order = mapShopifyOrder("org1", shopifyOrderPayload(), products);

    expect(order.external_id).toBe("6001");
    expect(order.order_number).toBe("#1001");
    expect(order.email).toBe("buyer@example.com");
    expect(order.customer_name).toBe("Dana Reyes");
    expect(order.subtotal).toBe(54.98);
    expect(order.shipping).toBe(5);
    expect(order.tax).toBe(4.54);
    expect(order.discount).toBe(5);
    expect(order.total).toBe(64.52);
    expect(order.shipping_address.city).toBe("San Francisco");
    expect(order.shipping_address.country_code).toBe("US");
    expect(order.lines).toHaveLength(1);
  });

  it("resolves lines to the catalog and freezes the cost at the moment of sale", () => {
    const order = mapShopifyOrder("org1", shopifyOrderPayload(), products);
    expect(order.lines[0].product_id).toBe("prod_1");
    expect(order.lines[0].supplier_vid).toBe("vid-1");
    // Cost is copied, not referenced — later catalog price changes must not
    // rewrite the margin on an order that already happened.
    expect(order.lines[0].unit_cost).toBe(9);
    expect(estimatedCogs(order)).toBe(18);
    expect(totalUnits(order)).toBe(2);
  });

  it("reads shipping from the money-set shape as well as the flat field", () => {
    const flat = mapShopifyOrder(
      "org1",
      shopifyOrderPayload({ total_shipping_price_set: undefined, total_shipping_price: "7.50" }),
      products,
    );
    expect(flat.shipping).toBe(7.5);
  });

  it("marks an order cancelled when Shopify has cancelled it", () => {
    const order = mapShopifyOrder(
      "org1",
      shopifyOrderPayload({ cancelled_at: "2026-07-21T00:00:00Z" }),
      products,
    );
    expect(order.stage).toBe("cancelled");
  });

  it("survives a sparse payload without throwing", () => {
    const order = mapShopifyOrder("org1", { id: 7 }, []);
    expect(order.external_id).toBe("7");
    expect(order.lines).toHaveLength(0);
    expect(order.total).toBe(0);
  });

  it("falls back to the billing address when nothing ships to a separate address", () => {
    const payload = shopifyOrderPayload({
      shipping_address: undefined,
      billing_address: { address1: "1 Billing Way", city: "Reno", country_code: "US", name: "B Payer" },
    });
    const order = mapShopifyOrder("org1", payload, products);
    expect(order.shipping_address.line1).toBe("1 Billing Way");
  });
});

describe("classifyOrder", () => {
  it("accepts a clean, paid, fully-mapped order", () => {
    expect(classifyOrder(makeOrder(), ACCEPT).stage).toBe("received");
  });

  it("holds an order whose payment has not been captured", () => {
    const result = classifyOrder(makeOrder({ financial_status: "pending" }), ACCEPT);
    expect(result.stage).toBe("on_hold");
    expect(result.hold_reason).toMatch(/not captured/i);
  });

  it("holds an order Shopify flagged as fraud risk", () => {
    const result = classifyOrder(makeOrder(), { holdRisky: true, riskRecommendation: "cancel" });
    expect(result.stage).toBe("on_hold");
    expect(result.hold_reason).toMatch(/fraud risk/i);
  });

  it("does not hold on risk when risk holding is switched off", () => {
    const result = classifyOrder(makeOrder(), { holdRisky: false, riskRecommendation: "cancel" });
    expect(result.stage).toBe("received");
  });

  it("holds an order containing something we cannot source", () => {
    const order = makeOrder({
      lines: [{ ...makeOrder().lines[0], product_id: null, supplier_vid: undefined }],
    });
    const result = classifyOrder(order, ACCEPT);
    expect(result.stage).toBe("on_hold");
    expect(result.hold_reason).toMatch(/can't be sourced/i);
    expect(unfulfillableLines(order)).toHaveLength(1);
  });

  it("holds a mapped product that has no supplier variant to order", () => {
    const order = makeOrder({ lines: [{ ...makeOrder().lines[0], supplier_vid: undefined }] });
    expect(classifyOrder(order, ACCEPT).stage).toBe("on_hold");
  });
});

describe("isPaid", () => {
  it("treats captured and authorized payments as actionable", () => {
    expect(isPaid({ financial_status: "paid" })).toBe(true);
    expect(isPaid({ financial_status: "authorized" })).toBe(true);
    expect(isPaid({ financial_status: "PAID" })).toBe(true);
  });

  it("does not act on pending, refunded, or voided payments", () => {
    expect(isPaid({ financial_status: "pending" })).toBe(false);
    expect(isPaid({ financial_status: "refunded" })).toBe(false);
    expect(isPaid({ financial_status: "voided" })).toBe(false);
    expect(isPaid({ financial_status: "" })).toBe(false);
  });
});

describe("saleEntries", () => {
  it("books revenue gross of discount, and accrues COGS at the frozen cost", () => {
    const entries = saleEntries(makeOrder());
    const byAccount = Object.fromEntries(entries.map((e) => [e.account, e]));

    // 54.98 subtotal + 5.00 discount = 59.98 of goods actually sold.
    expect(byAccount.revenue.amount).toBe(59.98);
    expect(byAccount.discount.amount).toBe(5);
    expect(byAccount.shipping_income.amount).toBe(5);
    expect(byAccount.tax.amount).toBe(4.54);
    expect(byAccount.cogs.amount).toBe(18);
    expect(byAccount.revenue.units).toBe(2);
  });

  it("dates entries to when the order was placed, not when we imported it", () => {
    for (const e of saleEntries(makeOrder())) expect(e.occurred_at).toBe("2026-07-20T10:00:00.000Z");
  });

  it("gives every entry a dedupe key scoped to the external order", () => {
    const keys = saleEntries(makeOrder()).map((e) => e.dedupe_key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k.startsWith("order:6001:")).toBe(true);
  });
});

describe("ingestShopifyOrder (persisted)", () => {
  beforeEach(resetStore);

  it("records the order and writes the sale to the books", async () => {
    const result = await ingestShopifyOrder("org1", shopifyOrderPayload(), [makeProduct()], ACCEPT);

    expect(result.created).toBe(true);
    expect(result.order.stage).toBe("received");
    expect(await listOrders("org1")).toHaveLength(1);

    const pnl = await getPnl("org1", "all");
    expect(pnl.gross_revenue).toBe(59.98);
    expect(pnl.cogs).toBe(18);
    expect(pnl.orders).toBe(1);
  });

  it("is idempotent — a redelivered webhook cannot double the revenue", async () => {
    const payload = shopifyOrderPayload();
    const products = [makeProduct()];

    await ingestShopifyOrder("org1", payload, products, ACCEPT);
    const second = await ingestShopifyOrder("org1", payload, products, ACCEPT);
    const third = await ingestShopifyOrder("org1", payload, products, ACCEPT);

    expect(second.created).toBe(false);
    expect(third.posted).toBe(0);
    expect(await listOrders("org1")).toHaveLength(1);
    expect((await getPnl("org1", "all")).gross_revenue).toBe(59.98);
  });

  it("does not book revenue for an order that was never paid", async () => {
    const result = await ingestShopifyOrder(
      "org1",
      shopifyOrderPayload({ financial_status: "pending" }),
      [makeProduct()],
      ACCEPT,
    );
    expect(result.order.stage).toBe("on_hold");
    expect((await getPnl("org1", "all")).gross_revenue).toBe(0);
  });

  it("books the sale once payment is captured on a previously pending order", async () => {
    const products = [makeProduct()];
    await ingestShopifyOrder(
      "org1",
      shopifyOrderPayload({ financial_status: "pending" }),
      products,
      ACCEPT,
    );
    await ingestShopifyOrder("org1", shopifyOrderPayload(), products, ACCEPT);

    expect(await listOrders("org1")).toHaveLength(1);
    const pnl = await getPnl("org1", "all");
    expect(pnl.gross_revenue).toBe(59.98);
    expect(pnl.orders).toBe(1);
  });

  it("never drags a shipped order back to an earlier stage", async () => {
    const products = [makeProduct()];
    const { order } = await ingestShopifyOrder("org1", shopifyOrderPayload(), products, ACCEPT);

    const { updateOrder } = await import("@/lib/orders");
    await updateOrder("org1", order.id, { stage: "shipped" });

    // A late orders/updated delivery arrives with no fulfillment recorded yet.
    await ingestShopifyOrder("org1", shopifyOrderPayload(), products, ACCEPT);
    expect((await findOrderByExternalId("org1", "6001"))?.stage).toBe("shipped");
  });

  it("does let a cancellation override an in-flight order", async () => {
    const products = [makeProduct()];
    const { order } = await ingestShopifyOrder("org1", shopifyOrderPayload(), products, ACCEPT);
    const { updateOrder } = await import("@/lib/orders");
    await updateOrder("org1", order.id, { stage: "awaiting_stock" });

    await ingestShopifyOrder(
      "org1",
      shopifyOrderPayload({ cancelled_at: "2026-07-21T00:00:00Z" }),
      products,
      ACCEPT,
    );
    expect((await findOrderByExternalId("org1", "6001"))?.stage).toBe("cancelled");
  });

  it("holds an order for a product that is not in the catalog", async () => {
    const result = await ingestShopifyOrder("org1", shopifyOrderPayload(), [], ACCEPT);
    expect(result.order.stage).toBe("on_hold");
    expect(result.order.hold_reason).toMatch(/can't be sourced/i);
    // The sale is still real money and still belongs in the books.
    expect((await getPnl("org1", "all")).gross_revenue).toBe(59.98);
  });
});

describe("recordRefund (persisted)", () => {
  beforeEach(resetStore);

  it("books the refund and marks a fully-refunded order", async () => {
    await ingestShopifyOrder("org1", shopifyOrderPayload(), [makeProduct()], ACCEPT);
    const order = await recordRefund("org1", "6001", 64.52, "refund_1", "changed mind");

    expect(order?.stage).toBe("refunded");
    expect(order?.refunded).toBe(64.52);
    expect((await getPnl("org1", "all")).refunds).toBe(64.52);
  });

  it("keeps a partially-refunded order in its current stage", async () => {
    await ingestShopifyOrder("org1", shopifyOrderPayload(), [makeProduct()], ACCEPT);
    const order = await recordRefund("org1", "6001", 10, "refund_1");

    expect(order?.stage).toBe("received");
    expect(order?.refunded).toBe(10);
  });

  it("does not double-book a redelivered refund webhook", async () => {
    await ingestShopifyOrder("org1", shopifyOrderPayload(), [makeProduct()], ACCEPT);
    await recordRefund("org1", "6001", 10, "refund_1");
    await recordRefund("org1", "6001", 10, "refund_1");

    expect((await getPnl("org1", "all")).refunds).toBe(10);
  });

  it("ignores a refund for an order we never saw", async () => {
    expect(await recordRefund("org1", "does-not-exist", 10, "refund_x")).toBeNull();
  });
});

describe("productPerformance", () => {
  it("attributes units, revenue, cost and margin to each product", () => {
    const rows = productPerformance([
      makeOrder({ id: "a" }),
      makeOrder({
        id: "b",
        lines: [
          { ...makeOrder().lines[0], quantity: 1 },
          {
            sku: "prod_2",
            title: "Halo Neck Fan",
            quantity: 3,
            unit_price: 20,
            product_id: "prod_2",
            unit_cost: 5,
          },
        ],
      }),
    ]);

    const lamp = rows.find((r) => r.product_id === "prod_1")!;
    // 2 units at 29.99 plus 1 more = 3 units, cost 9 each.
    expect(lamp.units).toBe(3);
    expect(lamp.revenue).toBe(89.97);
    expect(lamp.cogs).toBe(27);
    expect(lamp.gross_profit).toBe(62.97);

    const fan = rows.find((r) => r.product_id === "prod_2")!;
    expect(fan.units).toBe(3);
    expect(fan.gross_profit).toBe(45);
    expect(fan.margin_pct).toBe(75);
  });

  it("ranks by gross profit, not revenue", () => {
    const rows = productPerformance([
      makeOrder({
        id: "a",
        lines: [
          { ...makeOrder().lines[0], quantity: 1, unit_price: 100, unit_cost: 95 },
          {
            sku: "b",
            title: "Better margin",
            quantity: 1,
            unit_price: 50,
            product_id: "p2",
            unit_cost: 5,
          },
        ],
      }),
    ]);
    expect(rows[0].title).toBe("Better margin");
  });

  it("excludes cancelled and refunded orders from product performance", () => {
    expect(
      productPerformance([
        makeOrder({ id: "a", stage: "cancelled" }),
        makeOrder({ id: "b", stage: "refunded" }),
      ]),
    ).toHaveLength(0);
  });

  it("groups unmatched lines by title so nothing sold goes unreported", () => {
    const rows = productPerformance([
      makeOrder({
        id: "a",
        lines: [{ ...makeOrder().lines[0], product_id: null, title: "Mystery Item" }],
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].product_id).toBeNull();
    expect(rows[0].title).toBe("Mystery Item");
  });
});
