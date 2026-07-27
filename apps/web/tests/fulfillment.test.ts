import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeOrder, makeProduct, resetStore } from "./helpers";

/**
 * Fulfillment is the only part of the system that moves the owner's money to an
 * outside party, so it is tested against stubbed integrations rather than left to
 * production to discover. The stubs record what was sent, which is how we assert
 * that an order is never bought twice and never bought over the cap.
 */

const cjCreateOrder = vi.fn();
const cjGetOrderStatus = vi.fn();
const cjGetVariant = vi.fn();
const cjGetTracking = vi.fn();
const fulfillShopifyOrder = vi.fn();
const listShopifyOrders = vi.fn();
const getOrderRiskRecommendation = vi.fn();

vi.mock("@/lib/suppliers/cj", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/suppliers/cj")>()),
  cjCreateOrder: (...args: unknown[]) => cjCreateOrder(...args),
  cjGetOrderStatus: (...args: unknown[]) => cjGetOrderStatus(...args),
  cjGetVariant: (...args: unknown[]) => cjGetVariant(...args),
  cjGetTracking: (...args: unknown[]) => cjGetTracking(...args),
}));

vi.mock("@/lib/shopify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/shopify")>()),
  fulfillShopifyOrder: (...args: unknown[]) => fulfillShopifyOrder(...args),
  listShopifyOrders: (...args: unknown[]) => listShopifyOrders(...args),
  getOrderRiskRecommendation: (...args: unknown[]) => getOrderRiskRecommendation(...args),
}));

vi.mock("@/lib/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store")>()),
  resolveShopifyToken: async () => ({ ok: true, shop: "acme.myshopify.com", token: "shpat_x" }),
  resolveCJToken: async () => ({ ok: true, token: "cj_token" }),
  getCJCreds: async () => ({ email: "a@b.c", api_key: "k", connected_at: "" }),
  // These tests exercise the cycle as it behaves once the owner has unlocked
  // autonomous fulfillment; the locked-by-default posture is covered by the
  // governance suite.
  getOrgSettings: async () => ({ autopilot: true, auto_publish: true, auto_fulfill: true }),
  listProducts: async () => [makeProduct()],
  updateProduct: async () => null,
}));

const { placeSupplierOrder, pushFulfillment, syncTracking, runFulfillmentCycle, confirmDelivery } =
  await import("@/lib/fulfillment");
const { getOrder, saveOrder, listOrders } = await import("@/lib/orders");
const { getPnl } = await import("@/lib/ledger");
const { AUTOPILOT_MAX_ORDER_COST } = await import("@/lib/config");

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  cjCreateOrder.mockResolvedValue({
    ok: true,
    order_id: "CJ-777",
    order_number: "CJ777",
    product_amount: 20,
    postage_amount: 4.5,
  });
  cjGetOrderStatus.mockResolvedValue({ ok: true, status: "processing" });
  fulfillShopifyOrder.mockResolvedValue({ ok: true, fulfillment_id: 1 });
  listShopifyOrders.mockResolvedValue({ ok: true, orders: [] });
  getOrderRiskRecommendation.mockResolvedValue("accept");
  cjGetTracking.mockResolvedValue({ ok: true, delivered: false, status: "In transit" });
});

describe("placeSupplierOrder", () => {
  it("buys the goods and records the supplier order on the order", async () => {
    await saveOrder(makeOrder());
    const result = await placeSupplierOrder("org1", "order_1");

    expect(result.ok).toBe(true);
    expect(cjCreateOrder).toHaveBeenCalledTimes(1);

    const order = await getOrder("org1", "order_1");
    expect(order?.stage).toBe("awaiting_stock");
    expect(order?.supplier_order_id).toBe("CJ-777");
    expect(order?.cogs).toBe(20);
    expect(order?.supplier_shipping).toBe(4.5);
  });

  it("sends the customer's real shipping address to the supplier", async () => {
    await saveOrder(makeOrder());
    await placeSupplierOrder("org1", "order_1");

    const [, request] = cjCreateOrder.mock.calls[0] as [string, Record<string, unknown>];
    expect(request.name).toBe("Dana Reyes");
    expect(request.address1).toBe("410 Mission St");
    expect(request.city).toBe("San Francisco");
    expect(request.zip).toBe("94105");
    expect(request.country_code).toBe("US");
    expect(request.items).toEqual([{ vid: "vid-1", quantity: 2 }]);
  });

  it("never buys the same order twice, however often it is retried", async () => {
    await saveOrder(makeOrder());
    await placeSupplierOrder("org1", "order_1");
    const second = await placeSupplierOrder("org1", "order_1");

    expect(second.ok).toBe(true);
    expect(second.detail).toMatch(/already placed/i);
    expect(cjCreateOrder).toHaveBeenCalledTimes(1);
  });

  it("trues COGS up to what the supplier actually charged", async () => {
    const order = makeOrder();
    await saveOrder(order);
    // The sale accrues COGS at the cost frozen on the line: 2 × $9 = $18.
    const { postEntries } = await import("@/lib/ledger");
    const { saleEntries } = await import("@/lib/orders");
    await postEntries("org1", saleEntries(order));
    expect((await getPnl("org1", "all")).cogs).toBe(18);

    // The supplier then bills $20 for goods plus $4.50 shipping.
    await placeSupplierOrder("org1", "order_1");

    const pnl = await getPnl("org1", "all");
    expect(pnl.cogs).toBe(20);
    expect(pnl.supplier_shipping).toBe(4.5);
  });

  it("trues COGS back down when the supplier charged less than estimated", async () => {
    cjCreateOrder.mockResolvedValue({
      ok: true,
      order_id: "CJ-778",
      product_amount: 14,
      postage_amount: 0,
    });
    const order = makeOrder();
    await saveOrder(order);
    const { postEntries } = await import("@/lib/ledger");
    const { saleEntries } = await import("@/lib/orders");
    await postEntries("org1", saleEntries(order));

    await placeSupplierOrder("org1", "order_1");
    expect((await getPnl("org1", "all")).cogs).toBe(14);
  });

  it("refuses to spend above the autonomous cost cap", async () => {
    const expensive = makeOrder({
      lines: [{ ...makeOrder().lines[0], quantity: 1, unit_cost: AUTOPILOT_MAX_ORDER_COST + 50 }],
    });
    await saveOrder(expensive);

    const result = await placeSupplierOrder("org1", "order_1");
    expect(result.ok).toBe(false);
    expect(result.requires_approval).toBe(true);
    expect(cjCreateOrder).not.toHaveBeenCalled();
  });

  it("spends above the cap once the owner has explicitly approved", async () => {
    await saveOrder(
      makeOrder({
        lines: [{ ...makeOrder().lines[0], quantity: 1, unit_cost: AUTOPILOT_MAX_ORDER_COST + 50 }],
      }),
    );
    const result = await placeSupplierOrder("org1", "order_1", { bypassCostCap: true });
    expect(result.ok).toBe(true);
    expect(cjCreateOrder).toHaveBeenCalledTimes(1);
  });

  it("does not buy goods for an order that was never paid for", async () => {
    await saveOrder(makeOrder({ financial_status: "pending" }));
    const result = await placeSupplierOrder("org1", "order_1");

    expect(result.ok).toBe(false);
    expect(cjCreateOrder).not.toHaveBeenCalled();
  });

  it("does not buy goods for a cancelled or refunded order", async () => {
    await saveOrder(makeOrder({ id: "cancelled_1", stage: "cancelled" }));
    await saveOrder(makeOrder({ id: "refunded_1", stage: "refunded" }));

    expect((await placeSupplierOrder("org1", "cancelled_1")).ok).toBe(false);
    expect((await placeSupplierOrder("org1", "refunded_1")).ok).toBe(false);
    expect(cjCreateOrder).not.toHaveBeenCalled();
  });

  it("holds the order instead of guessing when a line cannot be sourced", async () => {
    cjGetVariant.mockResolvedValue({ ok: false, error: "no variants" });
    await saveOrder(
      makeOrder({ lines: [{ ...makeOrder().lines[0], product_id: null, supplier_vid: undefined }] }),
    );

    const result = await placeSupplierOrder("org1", "order_1");
    expect(result.ok).toBe(false);
    expect(cjCreateOrder).not.toHaveBeenCalled();
    expect((await getOrder("org1", "order_1"))?.stage).toBe("on_hold");
  });

  it("holds the order when there is no usable shipping address", async () => {
    await saveOrder(
      makeOrder({
        shipping_address: { ...makeOrder().shipping_address, line1: "", country_code: "" },
      }),
    );
    const result = await placeSupplierOrder("org1", "order_1");

    expect(result.ok).toBe(false);
    expect(cjCreateOrder).not.toHaveBeenCalled();
    expect((await getOrder("org1", "order_1"))?.hold_reason).toMatch(/address/i);
  });

  it("holds the order and records why when the supplier rejects it", async () => {
    cjCreateOrder.mockResolvedValue({ ok: false, error: "insufficient balance" });
    await saveOrder(makeOrder());

    const result = await placeSupplierOrder("org1", "order_1");
    expect(result.ok).toBe(false);

    const order = await getOrder("org1", "order_1");
    expect(order?.stage).toBe("on_hold");
    expect(order?.hold_reason).toMatch(/insufficient balance/);
    // No supplier order id means a later retry is still allowed.
    expect(order?.supplier_order_id).toBeUndefined();
  });
});

describe("syncTracking", () => {
  it("waits quietly while the supplier is still processing", async () => {
    await saveOrder(makeOrder({ stage: "awaiting_stock", supplier_order_id: "CJ-777" }));
    const result = await syncTracking("org1", "order_1");

    expect(result.ok).toBe(true);
    expect(fulfillShopifyOrder).not.toHaveBeenCalled();
    expect((await getOrder("org1", "order_1"))?.stage).toBe("awaiting_stock");
  });

  it("ships the order to the customer the moment tracking exists", async () => {
    cjGetOrderStatus.mockResolvedValue({
      ok: true,
      status: "shipped",
      tracking_number: "LP00123456789CN",
      carrier: "CJPacket",
    });
    await saveOrder(makeOrder({ stage: "awaiting_stock", supplier_order_id: "CJ-777" }));

    const result = await syncTracking("org1", "order_1");
    expect(result.ok).toBe(true);
    expect(fulfillShopifyOrder).toHaveBeenCalledTimes(1);

    const [, , externalId, tracking] = fulfillShopifyOrder.mock.calls[0] as [
      string,
      string,
      string,
      { number: string; url?: string },
    ];
    expect(externalId).toBe("6001");
    expect(tracking.number).toBe("LP00123456789CN");
    expect(tracking.url).toContain("LP00123456789CN");

    const order = await getOrder("org1", "order_1");
    expect(order?.stage).toBe("shipped");
    expect(order?.tracking_number).toBe("LP00123456789CN");
  });

  it("does nothing for an order that was never placed with a supplier", async () => {
    await saveOrder(makeOrder());
    expect((await syncTracking("org1", "order_1")).ok).toBe(false);
    expect(cjGetOrderStatus).not.toHaveBeenCalled();
  });
});

describe("pushFulfillment", () => {
  it("treats an already-fulfilled Shopify order as shipped, not as a failure", async () => {
    fulfillShopifyOrder.mockResolvedValue({
      ok: false,
      error: "No open fulfillment orders — already fulfilled?",
    });
    await saveOrder(
      makeOrder({ stage: "awaiting_stock", supplier_order_id: "CJ-777", tracking_number: "T1" }),
    );

    const result = await pushFulfillment("org1", "order_1");
    expect(result.ok).toBe(true);
    expect((await getOrder("org1", "order_1"))?.stage).toBe("shipped");
  });

  it("records the failure without losing the order when Shopify errors", async () => {
    fulfillShopifyOrder.mockResolvedValue({ ok: false, error: "Shopify 500: upstream" });
    await saveOrder(
      makeOrder({ stage: "awaiting_stock", supplier_order_id: "CJ-777", tracking_number: "T1" }),
    );

    const result = await pushFulfillment("org1", "order_1");
    expect(result.ok).toBe(false);

    const order = await getOrder("org1", "order_1");
    // Still awaiting_stock, so the next cycle retries rather than stranding it.
    expect(order?.stage).toBe("awaiting_stock");
    expect(order?.events.some((e) => e.kind === "fulfillment_failed")).toBe(true);
  });
});

describe("runFulfillmentCycle", () => {
  it("places what it can and reports what it could not", async () => {
    await saveOrder(makeOrder({ id: "ok_1", external_id: "7001" }));
    await saveOrder(
      makeOrder({
        id: "held_1",
        external_id: "7002",
        lines: [{ ...makeOrder().lines[0], product_id: null, supplier_vid: undefined }],
      }),
    );
    cjGetVariant.mockResolvedValue({ ok: false, error: "no variants" });

    const cycle = await runFulfillmentCycle("org1");

    expect(cycle.placed).toBe(1);
    expect(cycle.on_hold).toBe(1);
    expect(cjCreateOrder).toHaveBeenCalledTimes(1);
  });

  it("holds rather than buys when an order exceeds the cap, and flags it for approval", async () => {
    await saveOrder(
      makeOrder({
        lines: [{ ...makeOrder().lines[0], quantity: 1, unit_cost: AUTOPILOT_MAX_ORDER_COST + 100 }],
      }),
    );

    const cycle = await runFulfillmentCycle("org1");
    expect(cycle.awaiting_approval).toBe(1);
    expect(cycle.placed).toBe(0);
    expect(cjCreateOrder).not.toHaveBeenCalled();
    expect((await getOrder("org1", "order_1"))?.stage).toBe("on_hold");
  });

  it("advances placed orders toward shipping in the same pass", async () => {
    cjGetOrderStatus.mockResolvedValue({
      ok: true,
      status: "shipped",
      tracking_number: "T-42",
      carrier: "CJPacket",
    });
    await saveOrder(makeOrder({ stage: "awaiting_stock", supplier_order_id: "CJ-777" }));

    const cycle = await runFulfillmentCycle("org1");
    expect(cycle.shipped).toBe(1);
    expect((await getOrder("org1", "order_1"))?.stage).toBe("shipped");
  });

  it("leaves already-shipped orders alone", async () => {
    await saveOrder(
      makeOrder({ stage: "shipped", supplier_order_id: "CJ-777", tracking_number: "T-42" }),
    );
    const cycle = await runFulfillmentCycle("org1");

    expect(cycle.placed).toBe(0);
    expect(cycle.shipped).toBe(0);
    expect(cjCreateOrder).not.toHaveBeenCalled();
    expect(await listOrders("org1")).toHaveLength(1);
  });
});

describe("isDeliveredStatus", () => {
  it("recognizes the wordings carriers actually use for arrival", async () => {
    const { isDeliveredStatus } = await import("@/lib/suppliers/cj");
    expect(isDeliveredStatus("Delivered")).toBe(true);
    expect(isDeliveredStatus("DELIVERED - left with resident")).toBe(true);
    expect(isDeliveredStatus("Signed for by D REYES")).toBe(true);
    expect(isDeliveredStatus("Parcel received by customer")).toBe(true);
  });

  it("does not mistake an in-progress status for arrival", async () => {
    const { isDeliveredStatus } = await import("@/lib/suppliers/cj");
    // The dangerous near-misses: these must never close an order out.
    expect(isDeliveredStatus("Out for delivery")).toBe(false);
    expect(isDeliveredStatus("Delivery attempted — no answer")).toBe(false);
    expect(isDeliveredStatus("Delivery failed")).toBe(false);
    expect(isDeliveredStatus("Not delivered")).toBe(false);
    expect(isDeliveredStatus("Ready for pickup")).toBe(false);
    expect(isDeliveredStatus("In transit")).toBe(false);
    expect(isDeliveredStatus("")).toBe(false);
    expect(isDeliveredStatus(undefined)).toBe(false);
  });
});

describe("confirmDelivery", () => {
  it("closes the order out once the carrier confirms arrival", async () => {
    cjGetTracking.mockResolvedValue({ ok: true, delivered: true, status: "Delivered" });
    await saveOrder(
      makeOrder({ stage: "shipped", supplier_order_id: "CJ-777", tracking_number: "T-1" }),
    );

    const result = await confirmDelivery("org1", "order_1");
    expect(result.ok).toBe(true);

    const order = await getOrder("org1", "order_1");
    expect(order?.stage).toBe("delivered");
    expect(order?.events.some((e) => e.kind === "delivered")).toBe(true);
  });

  it("leaves an in-transit parcel alone", async () => {
    cjGetTracking.mockResolvedValue({ ok: true, delivered: false, status: "In transit" });
    await saveOrder(
      makeOrder({ stage: "shipped", supplier_order_id: "CJ-777", tracking_number: "T-1" }),
    );

    const result = await confirmDelivery("org1", "order_1");
    expect(result.ok).toBe(true);
    expect((await getOrder("org1", "order_1"))?.stage).toBe("shipped");
  });

  it("stops polling an order that is already delivered", async () => {
    await saveOrder(
      makeOrder({ stage: "delivered", supplier_order_id: "CJ-777", tracking_number: "T-1" }),
    );
    const result = await confirmDelivery("org1", "order_1");

    expect(result.ok).toBe(true);
    expect(cjGetTracking).not.toHaveBeenCalled();
  });

  it("advances shipped orders to delivered inside the cycle", async () => {
    cjGetTracking.mockResolvedValue({ ok: true, delivered: true, status: "Delivered" });
    await saveOrder(
      makeOrder({ stage: "shipped", supplier_order_id: "CJ-777", tracking_number: "T-1" }),
    );

    const cycle = await runFulfillmentCycle("org1");
    expect(cycle.delivered).toBe(1);
    expect((await getOrder("org1", "order_1"))?.stage).toBe("delivered");
  });
});
