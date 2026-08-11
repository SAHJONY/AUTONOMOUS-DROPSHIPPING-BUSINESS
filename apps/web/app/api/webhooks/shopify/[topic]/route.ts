import { error, json } from "@/lib/api";
import { HOLD_RISKY_ORDERS, SHOPIFY_WEBHOOK_SECRET } from "@/lib/config";
import { verifyWebhookSignature } from "@/lib/shopify";
import { ingestShopifyOrder, recordRefund, updateOrder, findOrderByExternalId } from "@/lib/orders";
import { getShopifyCreds, listAllOrgs, listProducts } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify's real-time order feed.
 *
 * Registered as `/api/webhooks/shopify/orders.create` (the topic's slash becomes
 * a dot so it fits one path segment). Every delivery is HMAC-verified against
 * SHOPIFY_WEBHOOK_SECRET before a single byte of it is trusted — this endpoint
 * writes to the books, so an unauthenticated caller here could invent revenue.
 *
 * Delivery is at-least-once by design, and Shopify retries anything that doesn't
 * answer in 5 seconds. Both are handled by making ingestion idempotent rather
 * than by trying to deduplicate deliveries.
 */
export async function POST(req: Request, { params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;

  // Read the body as text: HMAC is computed over the exact bytes Shopify sent,
  // so parsing before verifying would be verifying a different message.
  const rawBody = await req.text();
  const signature = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const shopDomain = (req.headers.get("x-shopify-shop-domain") ?? "").toLowerCase();

  if (!SHOPIFY_WEBHOOK_SECRET) {
    return error("Webhooks are not configured on this deployment.", 503);
  }
  if (!(await verifyWebhookSignature(rawBody, signature, SHOPIFY_WEBHOOK_SECRET))) {
    return error("Invalid webhook signature.", 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return error("Malformed webhook body.", 400);
  }

  // Route the event to the org that owns this store.
  const orgId = await resolveOrgForShop(shopDomain);
  if (!orgId) {
    // 200 rather than 404: a store we don't recognize should stop retrying, not
    // hammer us forever.
    return json({ ok: true, ignored: `No organization is connected to ${shopDomain || "this shop"}.` });
  }

  const normalized = topic.replace(/\./g, "/");
  switch (normalized) {
    case "orders/create":
    case "orders/updated": {
      const products = await listProducts(orgId);
      const result = await ingestShopifyOrder(orgId, payload, products, {
        holdRisky: HOLD_RISKY_ORDERS,
        // Shopify does not include the fraud assessment in the order payload;
        // the polling sync fetches it for orders it hasn't judged yet.
        riskRecommendation: "accept",
      });
      return json({
        ok: true,
        topic: normalized,
        order_id: result.order.id,
        created: result.created,
        ledger_entries: result.posted,
      });
    }

    case "orders/cancelled": {
      const existing = await findOrderByExternalId(orgId, String(payload.id ?? ""));
      if (existing) {
        await updateOrder(
          orgId,
          existing.id,
          { stage: "cancelled" },
          { kind: "cancelled", detail: "Cancelled in Shopify." },
        );
      }
      return json({ ok: true, topic: normalized, cancelled: !!existing });
    }

    case "refunds/create": {
      const orderId = String(payload.order_id ?? "");
      const refundId = String(payload.id ?? "");
      const amount = refundAmount(payload);
      const order = await recordRefund(orgId, orderId, amount, refundId, String(payload.note ?? ""));
      return json({ ok: true, topic: normalized, refunded: amount, matched: !!order });
    }

    default:
      // Acknowledge unknown topics so Shopify stops retrying them.
      return json({ ok: true, topic: normalized, ignored: true });
  }
}

/**
 * Total a refund payload. Shopify reports the money in `transactions`, and the
 * restocked line items separately; the transactions are what actually left the
 * account, so those are what the books record.
 */
function refundAmount(payload: Record<string, unknown>): number {
  const transactions = Array.isArray(payload.transactions)
    ? (payload.transactions as Record<string, unknown>[])
    : [];
  const fromTransactions = transactions
    .filter((t) => String(t.kind ?? "") === "refund" && String(t.status ?? "success") === "success")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  if (fromTransactions > 0) return fromTransactions;

  const lineItems = Array.isArray(payload.refund_line_items)
    ? (payload.refund_line_items as Record<string, unknown>[])
    : [];
  return lineItems.reduce((sum, li) => sum + (Number(li.subtotal) || 0), 0);
}

/** Find the organization whose connected store matches the delivering shop. */
async function resolveOrgForShop(shopDomain: string): Promise<string | null> {
  if (!shopDomain) return null;
  for (const org of await listAllOrgs()) {
    const creds = await getShopifyCreds(org.id);
    if (creds?.shop?.toLowerCase() === shopDomain) return org.id;
  }
  return null;
}
