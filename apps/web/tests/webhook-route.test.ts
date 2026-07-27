import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeProduct, resetStore, shopifyOrderPayload } from "./helpers";

/**
 * The webhook route is where outside money enters the system, so it is tested at
 * the handler level: signature enforcement, shop routing, topic dispatch, and the
 * refund arithmetic all have to hold together, not just individually.
 */
const SECRET = "shpss_route_test_secret";
const SHOP = "acme.myshopify.com";

vi.mock("@/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config")>()),
  SHOPIFY_WEBHOOK_SECRET: SECRET,
  HOLD_RISKY_ORDERS: true,
}));

vi.mock("@/lib/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store")>()),
  listAllOrgs: async () => [{ id: "org1", name: "Acme", created_at: "" }],
  getShopifyCreds: async () => ({ shop: SHOP, token: "shpat_x", connected_at: "" }),
  listProducts: async () => [makeProduct()],
}));

const { POST } = await import("@/app/api/webhooks/shopify/[topic]/route");
const { getPnl } = await import("@/lib/ledger");
const { listOrders, findOrderByExternalId } = await import("@/lib/orders");

function deliver(topic: string, payload: unknown, opts: { signature?: string; shop?: string } = {}) {
  const body = JSON.stringify(payload);
  const signature =
    opts.signature ?? createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
  const req = new Request(`https://app.test/api/webhooks/shopify/${topic}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-hmac-sha256": signature,
      "x-shopify-shop-domain": opts.shop ?? SHOP,
    },
    body,
  });
  return POST(req, { params: Promise.resolve({ topic }) });
}

beforeEach(resetStore);

describe("POST /api/webhooks/shopify/[topic]", () => {
  it("records a signed order and writes it to the books", async () => {
    const res = await deliver("orders.create", shopifyOrderPayload());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.created).toBe(true);
    expect(body.ledger_entries).toBeGreaterThan(0);

    expect(await listOrders("org1")).toHaveLength(1);
    const pnl = await getPnl("org1", "all");
    expect(pnl.gross_revenue).toBe(59.98);
    expect(pnl.orders).toBe(1);
  });

  it("rejects an unsigned or wrongly-signed delivery without touching the books", async () => {
    expect((await deliver("orders.create", shopifyOrderPayload(), { signature: "" })).status).toBe(401);
    expect(
      (await deliver("orders.create", shopifyOrderPayload(), { signature: "d29uZy1zaWc=" })).status,
    ).toBe(401);

    expect(await listOrders("org1")).toHaveLength(0);
    expect((await getPnl("org1", "all")).gross_revenue).toBe(0);
  });

  it("stays idempotent when Shopify redelivers the same order", async () => {
    await deliver("orders.create", shopifyOrderPayload());
    await deliver("orders.create", shopifyOrderPayload());
    await deliver("orders.updated", shopifyOrderPayload());

    expect(await listOrders("org1")).toHaveLength(1);
    expect((await getPnl("org1", "all")).gross_revenue).toBe(59.98);
  });

  it("acknowledges a shop it does not recognize instead of retrying forever", async () => {
    const res = await deliver("orders.create", shopifyOrderPayload(), { shop: "stranger.myshopify.com" });
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toMatch(/No organization/);
    expect(await listOrders("org1")).toHaveLength(0);
  });

  it("cancels an order on the cancellation topic", async () => {
    await deliver("orders.create", shopifyOrderPayload());
    const res = await deliver("orders.cancelled", shopifyOrderPayload({ cancelled_at: "2026-07-21T00:00:00Z" }));

    expect((await res.json()).cancelled).toBe(true);
    expect((await findOrderByExternalId("org1", "6001"))?.stage).toBe("cancelled");
  });

  it("books a refund from the transaction amounts", async () => {
    await deliver("orders.create", shopifyOrderPayload());
    const res = await deliver("refunds.create", {
      id: 8801,
      order_id: 6001,
      note: "damaged in transit",
      transactions: [{ kind: "refund", status: "success", amount: "20.00" }],
      refund_line_items: [{ subtotal: "999.00" }],
    });

    // The transaction is what actually left the account — not the line subtotal.
    expect((await res.json()).refunded).toBe(20);
    expect((await getPnl("org1", "all")).refunds).toBe(20);
  });

  it("falls back to refunded line items when there are no transactions", async () => {
    await deliver("orders.create", shopifyOrderPayload());
    const res = await deliver("refunds.create", {
      id: 8802,
      order_id: 6001,
      refund_line_items: [{ subtotal: "12.50" }, { subtotal: "2.50" }],
    });

    expect((await res.json()).refunded).toBe(15);
    expect((await getPnl("org1", "all")).refunds).toBe(15);
  });

  it("ignores a failed refund transaction", async () => {
    await deliver("orders.create", shopifyOrderPayload());
    await deliver("refunds.create", {
      id: 8803,
      order_id: 6001,
      transactions: [{ kind: "refund", status: "failure", amount: "50.00" }],
    });

    expect((await getPnl("org1", "all")).refunds).toBe(0);
  });

  it("acknowledges topics it does not handle so Shopify stops retrying", async () => {
    const res = await deliver("customers.create", { id: 1 });
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe(true);
  });

  it("rejects a body that is not valid JSON", async () => {
    const body = "{not json";
    const req = new Request("https://app.test/api/webhooks/shopify/orders.create", {
      method: "POST",
      headers: {
        "x-shopify-hmac-sha256": createHmac("sha256", SECRET).update(body, "utf8").digest("base64"),
        "x-shopify-shop-domain": SHOP,
      },
      body,
    });
    const res = await POST(req, { params: Promise.resolve({ topic: "orders.create" }) });
    expect(res.status).toBe(400);
  });
});
