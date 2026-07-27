/**
 * The fulfillment engine — where a dropshipping business actually earns its money.
 *
 * Three stages, each safe to re-run:
 *
 *   1. `placeSupplierOrder`  paid order → real order at CJ, COGS trued up in the books
 *   2. `syncTracking`        placed order → poll CJ until a tracking number exists
 *   3. `pushFulfillment`     tracking number → Shopify fulfillment, customer emailed
 *
 * Placement is the only autonomous action in the whole platform that spends real
 * cash, so it is gated twice: by `auto_fulfill` (is the loop on at all) and by
 * AUTOPILOT_MAX_ORDER_COST (is *this* order small enough to buy unattended).
 * Anything above the cap becomes an approval the owner decides on.
 */
import { AUTOPILOT_MAX_ORDER_COST, HOLD_RISKY_ORDERS } from "./config";
import { postEntries } from "./ledger";
import {
  estimatedCogs,
  findOrderByExternalId,
  getOrder,
  ingestShopifyOrder,
  isPaid,
  listOrders,
  unfulfillableLines,
  updateOrder,
} from "./orders";
import {
  fulfillShopifyOrder,
  getOrderRiskRecommendation,
  listShopifyOrders,
} from "./shopify";
import {
  cjCreateOrder,
  cjGetOrderStatus,
  cjGetTracking,
  cjGetVariant,
  trackingUrl,
} from "./suppliers/cj";
import {
  getCJCreds,
  listProducts,
  resolveCJToken,
  resolveShopifyToken,
  getOrgSettings,
  updateProduct,
} from "./store";
import type { Order } from "./types";

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface StepResult {
  ok: boolean;
  detail: string;
  requires_approval?: boolean;
}

/* ---------- 1. order intake ---------- */

/**
 * Pull recent orders from Shopify into our system. Used by the cron and by the
 * manual "Sync orders" action; the webhook path is the real-time equivalent.
 * `since` defaults to the last 7 days, which comfortably covers any webhook gap.
 */
/**
 * Clamp the lookback window to something a Shopify query can actually express.
 *
 * This value reaches here from two places that cannot be trusted to send a sane
 * number: a request body, and an agent tool where the model chooses it. Left
 * unguarded, a non-numeric value produced `new Date(NaN).toISOString()`, which
 * throws RangeError and 500s the endpoint — and a negative value silently
 * queried the *future*, returning nothing and looking like "no new orders",
 * which is the more dangerous of the two failures.
 */
export function clampSinceDays(value: unknown, fallback = 7): number {
  // Absent or non-numeric means "not specified", so the default applies. Note
  // Number(null) and Number([]) are both 0, which would otherwise read as a
  // deliberate zero-day window rather than as a missing value.
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  // A real but nonsensical number is clamped rather than discarded — the caller
  // did mean a window, they just named an impossible one.
  return Math.min(Math.max(Math.floor(n), 1), 90);
}

export async function syncShopifyOrders(
  orgId: string,
  opts: { sinceDays?: number; limit?: number } = {},
): Promise<{ ok: boolean; imported: number; updated: number; error?: string }> {
  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.token || !resolved.shop) {
    return { ok: false, imported: 0, updated: 0, error: resolved.error ?? "Shopify not connected." };
  }
  const since = new Date(
    Date.now() - clampSinceDays(opts.sinceDays) * 86_400_000,
  ).toISOString();
  const page = await listShopifyOrders(resolved.shop, resolved.token, {
    since,
    limit: opts.limit ?? 50,
  });
  if (!page.ok || !page.orders) {
    return { ok: false, imported: 0, updated: 0, error: page.error };
  }

  const products = await listProducts(orgId);
  let imported = 0;
  let updated = 0;
  for (const payload of page.orders) {
    // Only pay for a risk check on orders we haven't already judged.
    const externalId = String(payload.id ?? "");
    const known = externalId ? await findOrderByExternalId(orgId, externalId) : null;
    const riskRecommendation =
      !known && HOLD_RISKY_ORDERS && externalId
        ? await getOrderRiskRecommendation(resolved.shop, resolved.token, externalId)
        : "accept";
    const result = await ingestShopifyOrder(orgId, payload, products, {
      holdRisky: HOLD_RISKY_ORDERS,
      riskRecommendation,
    });
    if (result.created) imported++;
    else updated++;
  }
  return { ok: true, imported, updated };
}

/* ---------- 2. supplier placement ---------- */

/**
 * Fill in a line's supplier variant id when the catalog is missing one — this
 * happens for products that were sourced before variant capture, or added by hand.
 * Resolved ids are written back to the catalog so the lookup happens once.
 */
async function backfillSupplierIds(orgId: string, order: Order): Promise<Order> {
  const products = await listProducts(orgId);
  const lines = [...order.lines];
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.supplier_vid || !line.product_id) continue;
    const product = products.find((p) => p.id === line.product_id);
    const pid = product?.supplier_pid;
    if (!pid) continue;

    const token = await resolveCJToken(orgId);
    if (!token.ok || !token.token) break;
    const variant = await cjGetVariant(token.token, pid);
    if (!variant.ok || !variant.vid) continue;

    lines[i] = { ...line, supplier_pid: pid, supplier_vid: variant.vid };
    if (variant.cost && !line.unit_cost) lines[i].unit_cost = r2(variant.cost);
    await updateProduct(orgId, product!.id, { supplier_vid: variant.vid, sku: variant.sku });
    changed = true;
  }

  if (!changed) return order;
  const updated = await updateOrder(orgId, order.id, { lines }, {
    kind: "resolved",
    detail: "Resolved supplier variant ids for previously unmapped lines.",
  });
  return updated ?? { ...order, lines };
}

/**
 * Buy the goods. Idempotent on `supplier_order_id`: an order that already has one
 * is never placed twice, which matters because a retry here costs real money.
 */
export async function placeSupplierOrder(
  orgId: string,
  orderId: string,
  opts: { bypassCostCap?: boolean } = {},
): Promise<StepResult> {
  let order = await getOrder(orgId, orderId);
  if (!order) return { ok: false, detail: "Order not found." };
  if (order.supplier_order_id) {
    return { ok: true, detail: `Already placed with the supplier (${order.supplier_order_id}).` };
  }
  if (["cancelled", "refunded"].includes(order.stage)) {
    return { ok: false, detail: `Order is ${order.stage} — not ordering goods.` };
  }
  if (!isPaid(order)) {
    return { ok: false, detail: `Payment not captured (${order.financial_status || "unknown"}).` };
  }

  order = await backfillSupplierIds(orgId, order);

  const blocked = unfulfillableLines(order);
  if (blocked.length) {
    const reason = `Cannot source ${blocked.length} line(s): ${blocked.map((l) => l.title).join(", ").slice(0, 160)}.`;
    await updateOrder(orgId, order.id, { stage: "on_hold", hold_reason: reason }, {
      kind: "on_hold",
      detail: reason,
    });
    return { ok: false, detail: reason };
  }

  const cost = estimatedCogs(order);
  if (!opts.bypassCostCap && cost > AUTOPILOT_MAX_ORDER_COST) {
    return {
      ok: false,
      requires_approval: true,
      detail:
        `Supplier cost $${cost.toFixed(2)} exceeds the autonomous cap of ` +
        `$${AUTOPILOT_MAX_ORDER_COST.toFixed(2)} — owner approval required.`,
    };
  }

  if (!(await getCJCreds(orgId))) return { ok: false, detail: "No supplier connected." };
  const token = await resolveCJToken(orgId);
  if (!token.ok || !token.token) return { ok: false, detail: token.error ?? "Supplier auth failed." };

  const address = order.shipping_address;
  if (!address.line1 || !address.country_code) {
    const reason = "Order has no usable shipping address.";
    await updateOrder(orgId, order.id, { stage: "on_hold", hold_reason: reason }, {
      kind: "on_hold",
      detail: reason,
    });
    return { ok: false, detail: reason };
  }

  const placed = await cjCreateOrder(token.token, {
    order_number: order.order_number || order.external_id,
    email: order.email,
    name: address.name || order.customer_name,
    phone: address.phone,
    address1: address.line1,
    address2: address.line2,
    city: address.city,
    province: address.province,
    zip: address.zip,
    country: address.country,
    country_code: address.country_code,
    items: order.lines.map((l) => ({ vid: l.supplier_vid as string, quantity: l.quantity })),
  });

  if (!placed.ok) {
    const reason = `Supplier rejected the order: ${placed.error}`;
    await updateOrder(orgId, order.id, { stage: "on_hold", hold_reason: reason }, {
      kind: "placement_failed",
      detail: reason,
    });
    return { ok: false, detail: reason };
  }

  const actualGoods = placed.product_amount || cost;
  const postage = placed.postage_amount || 0;

  // True the accrual up to what the supplier actually charged, and book the
  // shipping cost the customer never sees.
  await postEntries(orgId, [
    {
      account: "cogs",
      amount: r2(-(actualGoods - cost)),
      signed: true,
      dedupe_key: `order:${order.external_id}:cogs:trueup`,
      memo: `COGS true-up on ${order.order_number} (estimated $${cost.toFixed(2)}, actual $${actualGoods.toFixed(2)})`,
      order_id: order.id,
      currency: order.currency,
    },
    {
      account: "supplier_shipping",
      amount: postage,
      dedupe_key: `order:${order.external_id}:supplier_shipping`,
      memo: `Supplier shipping on ${order.order_number}`,
      order_id: order.id,
      currency: order.currency,
    },
  ]);

  await updateOrder(
    orgId,
    order.id,
    {
      stage: "awaiting_stock",
      supplier: "cj",
      supplier_order_id: placed.order_id,
      supplier_order_number: placed.order_number,
      cogs: r2(actualGoods),
      supplier_shipping: r2(postage),
      hold_reason: undefined,
    },
    {
      kind: "placed",
      detail: `Placed with CJ (${placed.order_id}) — goods $${actualGoods.toFixed(2)}, shipping $${postage.toFixed(2)}.`,
    },
  );

  return {
    ok: true,
    detail: `Placed ${order.order_number} with the supplier for $${(actualGoods + postage).toFixed(2)}.`,
  };
}

/* ---------- 3. tracking and hand-off to the customer ---------- */

/**
 * Ask the supplier whether an order has shipped, and if so push the tracking
 * number to Shopify so the customer gets a real shipping notification.
 */
export async function syncTracking(orgId: string, orderId: string): Promise<StepResult> {
  const order = await getOrder(orgId, orderId);
  if (!order) return { ok: false, detail: "Order not found." };
  if (!order.supplier_order_id) return { ok: false, detail: "Not placed with a supplier yet." };
  if (order.tracking_number && order.stage === "shipped") {
    return { ok: true, detail: `Already shipped (${order.tracking_number}).` };
  }

  const token = await resolveCJToken(orgId);
  if (!token.ok || !token.token) return { ok: false, detail: token.error ?? "Supplier auth failed." };

  const status = await cjGetOrderStatus(token.token, order.supplier_order_id);
  if (!status.ok) return { ok: false, detail: status.error ?? "Could not read supplier status." };
  if (!status.tracking_number) {
    return { ok: true, detail: `Still with the supplier (${status.status || "processing"}).` };
  }

  const url = trackingUrl(status.tracking_number);
  await updateOrder(
    orgId,
    order.id,
    { tracking_number: status.tracking_number, tracking_url: url, carrier: status.carrier },
    { kind: "tracking", detail: `Supplier shipped — tracking ${status.tracking_number}.` },
  );

  return pushFulfillment(orgId, order.id);
}

/** Mark the order shipped on Shopify. Safe to retry; Shopify rejects duplicates. */
export async function pushFulfillment(orgId: string, orderId: string): Promise<StepResult> {
  const order = await getOrder(orgId, orderId);
  if (!order) return { ok: false, detail: "Order not found." };
  if (!order.tracking_number) return { ok: false, detail: "No tracking number yet." };

  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.token || !resolved.shop) {
    return { ok: false, detail: resolved.error ?? "Shopify not connected." };
  }

  const res = await fulfillShopifyOrder(resolved.shop, resolved.token, order.external_id, {
    number: order.tracking_number,
    url: order.tracking_url,
    company: order.carrier,
  });

  if (!res.ok) {
    // "Already fulfilled" is a success from our side — the customer has their email.
    const alreadyDone = /no open fulfillment orders/i.test(res.error ?? "");
    await updateOrder(
      orgId,
      order.id,
      alreadyDone ? { stage: "shipped" } : {},
      { kind: alreadyDone ? "shipped" : "fulfillment_failed", detail: res.error ?? "" },
    );
    return { ok: alreadyDone, detail: res.error ?? "Fulfillment failed." };
  }

  await updateOrder(orgId, order.id, { stage: "shipped", fulfillment_status: "fulfilled" }, {
    kind: "shipped",
    detail: `Customer notified with tracking ${order.tracking_number}.`,
  });
  return { ok: true, detail: `${order.order_number} marked shipped with tracking.` };
}

/**
 * Close a shipped order out once the carrier says it arrived.
 *
 * `delivered` is the point the sale is genuinely finished: the customer has the
 * goods, the money is earned rather than merely collected, and the order stops
 * being polled. Until this ran, orders sat at `shipped` forever and the stage
 * existed in name only.
 */
export async function confirmDelivery(orgId: string, orderId: string): Promise<StepResult> {
  const order = await getOrder(orgId, orderId);
  if (!order) return { ok: false, detail: "Order not found." };
  if (order.stage === "delivered") return { ok: true, detail: "Already delivered." };
  if (!order.tracking_number) return { ok: false, detail: "No tracking number to check." };

  const token = await resolveCJToken(orgId);
  if (!token.ok || !token.token) return { ok: false, detail: token.error ?? "Supplier auth failed." };

  const tracking = await cjGetTracking(token.token, order.tracking_number);
  if (!tracking.ok) return { ok: false, detail: tracking.error ?? "Could not read tracking." };
  if (!tracking.delivered) {
    return { ok: true, detail: `In transit${tracking.status ? ` — ${tracking.status}` : ""}.` };
  }

  await updateOrder(orgId, order.id, { stage: "delivered" }, {
    kind: "delivered",
    detail: `Carrier confirmed delivery${tracking.status ? ` — ${tracking.status}` : ""}.`,
  });
  return { ok: true, detail: `${order.order_number} delivered.` };
}

/* ---------- the loop ---------- */

export interface FulfillmentCycle {
  synced: { imported: number; updated: number };
  placed: number;
  shipped: number;
  delivered: number;
  awaiting_approval: number;
  on_hold: number;
  failures: string[];
}

/**
 * One full pass of the back half of the business: pull new orders, buy the goods
 * for everything within the cost cap, and ship anything the supplier has handed
 * a tracking number. This is what the cron calls.
 */
export async function runFulfillmentCycle(
  orgId: string,
  opts: { maxOrders?: number } = {},
): Promise<FulfillmentCycle> {
  const cycle: FulfillmentCycle = {
    synced: { imported: 0, updated: 0 },
    placed: 0,
    shipped: 0,
    delivered: 0,
    awaiting_approval: 0,
    on_hold: 0,
    failures: [],
  };

  const sync = await syncShopifyOrders(orgId);
  if (sync.ok) cycle.synced = { imported: sync.imported, updated: sync.updated };
  else if (sync.error) cycle.failures.push(`sync: ${sync.error}`);

  const settings = await getOrgSettings(orgId);
  const orders = await listOrders(orgId, 200);
  const budget = opts.maxOrders ?? 25;
  let handled = 0;

  for (const order of orders) {
    if (handled >= budget) break;

    if (settings.auto_fulfill && order.stage === "received") {
      handled++;
      const result = await placeSupplierOrder(orgId, order.id);
      if (result.ok) cycle.placed++;
      else if (result.requires_approval) {
        cycle.awaiting_approval++;
        await updateOrder(orgId, order.id, { stage: "on_hold", hold_reason: result.detail }, {
          kind: "awaiting_approval",
          detail: result.detail,
        });
      } else {
        cycle.failures.push(`${order.order_number}: ${result.detail}`);
      }
      continue;
    }

    if (order.stage === "awaiting_stock") {
      handled++;
      const result = await syncTracking(orgId, order.id);
      if (result.ok && /shipped/i.test(result.detail)) cycle.shipped++;
      else if (!result.ok) cycle.failures.push(`${order.order_number}: ${result.detail}`);
      continue;
    }

    // Follow parcels the rest of the way so orders finish at `delivered` rather
    // than sitting at `shipped` indefinitely.
    if (order.stage === "shipped" && order.tracking_number) {
      handled++;
      const result = await confirmDelivery(orgId, order.id);
      if (result.ok && /delivered\./i.test(result.detail)) cycle.delivered++;
    }
  }

  cycle.on_hold = (await listOrders(orgId, 200)).filter((o) => o.stage === "on_hold").length;
  return cycle;
}
