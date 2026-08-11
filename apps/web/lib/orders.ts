/**
 * Customer orders — the half of a dropshipping business that happens after the
 * sale.
 *
 * An order enters here from Shopify (webhook or polling sync), gets its lines
 * matched back to our catalog so we know what to buy and what it costs, and is
 * written to the books. From there `fulfillment.ts` drives the supplier leg.
 *
 * This module deliberately depends only on kv + ledger: the catalog is passed
 * in, which keeps the dependency graph acyclic and makes every mapping function
 * pure and directly testable.
 */
import { listGet, listPush, listReplace } from "./kv";
import { paymentFeeFor, postEntries } from "./ledger";
import { notifyOwnerTelegram } from "./telegram";
import type {
  Order,
  OrderEvent,
  OrderLine,
  OrderStage,
  Product,
  ShippingAddress,
} from "./types";

const ORDERS_CAP = 1000;
const key = (orgId: string) => `orders:${orgId}`;

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/* ---------- persistence ---------- */

export async function listOrders(orgId: string, limit = 200): Promise<Order[]> {
  return (await listGet<Order>(key(orgId))).slice(0, limit);
}

export async function getOrder(orgId: string, orderId: string): Promise<Order | null> {
  return (await listGet<Order>(key(orgId))).find((o) => o.id === orderId) ?? null;
}

export async function findOrderByExternalId(
  orgId: string,
  externalId: string,
): Promise<Order | null> {
  return (await listGet<Order>(key(orgId))).find((o) => o.external_id === externalId) ?? null;
}

export async function saveOrder(order: Order): Promise<void> {
  await listPush(key(order.org_id), order, ORDERS_CAP);
  await notifyOwnerTelegram("NEW ORDER", `${order.order_number}\n$${order.total.toFixed(2)} · ${order.lines.length} item(s)\nStage: ${order.stage}`);
}

export async function updateOrder(
  orgId: string,
  orderId: string,
  patch: Partial<Order>,
  event?: Omit<OrderEvent, "at">,
): Promise<Order | null> {
  const orders = await listGet<Order>(key(orgId));
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;
  const events = event
    ? [...orders[idx].events, { at: new Date().toISOString(), ...event }].slice(-50)
    : orders[idx].events;
  orders[idx] = { ...orders[idx], ...patch, events, updated_at: new Date().toISOString() };
  await listReplace(key(orgId), orders);
  if(event)await notifyOwnerTelegram("ORDER UPDATE", `${orders[idx].order_number}\n${event.kind}: ${event.detail}\nStage: ${orders[idx].stage}`);
  return orders[idx];
}

/* ---------- catalog matching ---------- */

/**
 * Resolve a Shopify line item back to a catalog product. Shopify identifiers are
 * checked first because they're exact; SKU and title are fallbacks for products
 * that were added to the store outside this system.
 */
export function matchProduct(
  line: { variant_id?: unknown; product_id?: unknown; sku?: unknown; title?: unknown },
  products: Product[],
): Product | null {
  const variantId = num(line.variant_id);
  const productId = num(line.product_id);
  const sku = str(line.sku).trim().toLowerCase();
  const title = str(line.title).trim().toLowerCase();

  if (variantId) {
    const hit = products.find((p) => p.shopify_variant_id === variantId);
    if (hit) return hit;
  }
  if (productId) {
    const hit = products.find((p) => p.shopify_id === productId);
    if (hit) return hit;
  }
  if (sku) {
    const hit = products.find((p) => (p.sku ?? "").trim().toLowerCase() === sku);
    if (hit) return hit;
  }
  if (title) {
    const hit = products.find((p) => p.title.trim().toLowerCase() === title);
    if (hit) return hit;
  }
  return null;
}

function mapAddress(raw: unknown): ShippingAddress {
  const a = (raw ?? {}) as Record<string, unknown>;
  const name =
    str(a.name).trim() || [str(a.first_name), str(a.last_name)].filter(Boolean).join(" ").trim();
  return {
    name,
    phone: str(a.phone),
    line1: str(a.address1),
    line2: str(a.address2),
    city: str(a.city),
    province: str(a.province),
    province_code: str(a.province_code),
    zip: str(a.zip),
    country: str(a.country),
    country_code: str(a.country_code),
  };
}

/** Shopify puts money in several shapes; read whichever one is present. */
function money(order: Record<string, unknown>, ...fields: string[]): number {
  for (const field of fields) {
    const direct = order[field];
    if (direct !== undefined && direct !== null && direct !== "") return num(direct);
    const set = order[`${field}_set`] as { shop_money?: { amount?: unknown } } | undefined;
    if (set?.shop_money?.amount !== undefined) return num(set.shop_money.amount);
  }
  return 0;
}

/**
 * Turn a raw Shopify order payload into our Order. Pure: no I/O, no clock reads
 * beyond `now`, so the mapping is exercised directly by the test suite.
 */
export function mapShopifyOrder(
  orgId: string,
  payload: Record<string, unknown>,
  products: Product[],
  now = new Date(),
): Order {
  const rawLines = Array.isArray(payload.line_items)
    ? (payload.line_items as Record<string, unknown>[])
    : [];

  const lines: OrderLine[] = rawLines.map((li) => {
    const product = matchProduct(li, products);
    return {
      sku: str(li.sku),
      title: str(li.title) || product?.title || "Item",
      quantity: Math.max(1, Math.round(num(li.quantity) || 1)),
      unit_price: num(li.price),
      product_id: product?.id ?? null,
      shopify_variant_id: num(li.variant_id) || undefined,
      supplier_pid: product?.supplier_pid,
      supplier_vid: product?.supplier_vid,
      // Frozen at the moment of sale — the catalog's cost will drift.
      unit_cost: r2(product?.cost ?? 0),
    };
  });

  const shipping = money(payload, "total_shipping_price", "shipping_price");
  const grossLineTotal =
    money(payload, "total_line_items_price") ||
    lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const discount = money(payload, "total_discounts");
  const tax = money(payload, "total_tax");
  const total = money(payload, "total_price") || grossLineTotal - discount + shipping + tax;

  const cancelledAt = str(payload.cancelled_at);
  const financialStatus = str(payload.financial_status);
  const fulfillmentStatus = str(payload.fulfillment_status);
  const placedAt = str(payload.created_at) || now.toISOString();
  const customer = (payload.customer ?? {}) as Record<string, unknown>;
  const address = mapAddress(payload.shipping_address ?? payload.billing_address);

  return {
    id: crypto.randomUUID().replace(/-/g, ""),
    org_id: orgId,
    channel: "shopify",
    external_id: str(payload.id),
    order_number: str(payload.name) || `#${str(payload.order_number)}`,
    email: str(payload.email) || str(payload.contact_email) || str(customer.email),
    customer_name:
      address.name ||
      [str(customer.first_name), str(customer.last_name)].filter(Boolean).join(" ").trim(),
    currency: str(payload.currency) || "USD",

    subtotal: r2(grossLineTotal - discount),
    shipping: r2(shipping),
    tax: r2(tax),
    discount: r2(discount),
    total: r2(total),

    financial_status: financialStatus,
    fulfillment_status: fulfillmentStatus,
    stage: cancelledAt ? "cancelled" : "received",

    lines,
    shipping_address: address,

    supplier: "",
    cogs: 0,
    supplier_shipping: 0,
    refunded: r2(money(payload, "total_refunded")),
    events: [{ at: now.toISOString(), kind: "received", detail: `Order imported from Shopify.` }],

    placed_at: placedAt,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/* ---------- classification ---------- */

/** An order is only actionable once the customer's money has actually landed. */
export function isPaid(order: Pick<Order, "financial_status">): boolean {
  return ["paid", "partially_paid", "authorized"].includes(order.financial_status.toLowerCase());
}

/** Lines we can't buy — either unmatched to the catalog or missing supplier ids. */
export function unfulfillableLines(order: Pick<Order, "lines">): OrderLine[] {
  return order.lines.filter((l) => !l.product_id || !l.supplier_vid);
}

/** Estimated supplier cost of an order, from the costs frozen at sale time. */
export function estimatedCogs(order: Pick<Order, "lines">): number {
  return r2(order.lines.reduce((sum, l) => sum + l.unit_cost * l.quantity, 0));
}

export function totalUnits(order: Pick<Order, "lines">): number {
  return order.lines.reduce((sum, l) => sum + l.quantity, 0);
}

/**
 * Decide where a freshly-ingested order belongs. Risky and unmappable orders go
 * on hold for a human rather than silently spending money at the supplier.
 */
export function classifyOrder(
  order: Order,
  opts: { holdRisky: boolean; riskRecommendation?: string },
): { stage: OrderStage; hold_reason?: string } {
  if (order.stage === "cancelled") return { stage: "cancelled" };
  if (order.refunded > 0 && order.refunded >= order.total) return { stage: "refunded" };
  if (!isPaid(order)) {
    return { stage: "on_hold", hold_reason: `Payment not captured (${order.financial_status || "unknown"}).` };
  }
  if (opts.holdRisky && ["cancel", "investigate"].includes((opts.riskRecommendation ?? "").toLowerCase())) {
    return { stage: "on_hold", hold_reason: `Shopify flagged this order as fraud risk (${opts.riskRecommendation}).` };
  }
  const blocked = unfulfillableLines(order);
  if (blocked.length) {
    return {
      stage: "on_hold",
      hold_reason: `${blocked.length} line(s) can't be sourced automatically: ${blocked
        .map((l) => l.title)
        .join(", ")
        .slice(0, 160)}.`,
    };
  }
  return { stage: "received" };
}

/* ---------- money at risk on cancelled orders ---------- */

export interface SupplierExposure {
  order_id: string;
  order_number: string;
  supplier_order_id: string;
  cost: number;
  /** True while the parcel has no tracking — the window where cancelling still works. */
  cancellable: boolean;
  reason: string;
}

/**
 * Orders the customer cancelled or refunded *after* we had already bought the
 * goods.
 *
 * This is the quiet money leak in dropshipping: the customer gets their money
 * back, the supplier keeps ours, and nothing in the system ever says so. The
 * refund shows up in the books but the matching COGS just sits there as a loss
 * nobody attributed. Surfacing it is the difference between a business that
 * knows its margins and one that wonders where the money went.
 *
 * Whether it can still be stopped depends on the parcel: no tracking number
 * means it has not shipped and the supplier order can usually be cancelled.
 * Once it is moving, the money is spent and the entry is a loss report.
 */
export function supplierExposure(orders: Order[]): SupplierExposure[] {
  return orders
    .filter(
      (o) =>
        ["cancelled", "refunded"].includes(o.stage) &&
        !!o.supplier_order_id &&
        // A delivered parcel is a different problem — the customer has the goods.
        o.stage !== "delivered",
    )
    .map((o) => {
      const cancellable = !o.tracking_number;
      return {
        order_id: o.id,
        order_number: o.order_number,
        supplier_order_id: o.supplier_order_id as string,
        cost: r2(o.cogs + o.supplier_shipping),
        cancellable,
        reason: cancellable
          ? `${o.stage === "refunded" ? "Refunded" : "Cancelled"} before the supplier shipped — cancel supplier order ${o.supplier_order_id} to recover the cost.`
          : `${o.stage === "refunded" ? "Refunded" : "Cancelled"} after the supplier shipped — the goods are in transit and this cost is unrecoverable.`,
      };
    })
    .sort((a, b) => Number(b.cancellable) - Number(a.cancellable) || b.cost - a.cost);
}

/** Total cash sitting on cancelled orders we already paid the supplier for. */
export function supplierExposureValue(orders: Order[]): number {
  return r2(supplierExposure(orders).reduce((sum, e) => sum + e.cost, 0));
}

/* ---------- per-product performance ---------- */

export interface ProductPerformance {
  product_id: string | null;
  title: string;
  units: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
}

/**
 * What each product actually earned, derived from the orders themselves.
 *
 * The ledger is the authority on totals, but it records money per order rather
 * than per line, so the per-product view is computed here from the persisted
 * order lines — the same frozen costs the books were built from, which keeps the
 * two consistent by construction.
 */
export function productPerformance(orders: Order[], sinceDays?: number): ProductPerformance[] {
  const cutoff = sinceDays ? Date.now() - sinceDays * 86_400_000 : null;
  const rows = new Map<string, ProductPerformance>();

  for (const order of orders) {
    if (["cancelled", "refunded"].includes(order.stage)) continue;
    if (cutoff && new Date(order.placed_at).getTime() < cutoff) continue;

    for (const line of order.lines) {
      const key = line.product_id ?? `title:${line.title}`;
      const row = rows.get(key) ?? {
        product_id: line.product_id,
        title: line.title,
        units: 0,
        revenue: 0,
        cogs: 0,
        gross_profit: 0,
        margin_pct: 0,
      };
      row.units += line.quantity;
      row.revenue = r2(row.revenue + line.unit_price * line.quantity);
      row.cogs = r2(row.cogs + line.unit_cost * line.quantity);
      rows.set(key, row);
    }
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      gross_profit: r2(row.revenue - row.cogs),
      margin_pct: row.revenue > 0 ? r2(((row.revenue - row.cogs) / row.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.gross_profit - a.gross_profit);
}

/* ---------- ingestion ---------- */

/**
 * Ledger postings for a newly recognized sale. COGS is accrued here at the cost
 * frozen on the line, then trued up in `fulfillment.ts` once the supplier's real
 * invoice is known — so margin is meaningful the moment an order lands, and
 * exact once it ships.
 */
export function saleEntries(order: Order): Parameters<typeof postEntries>[1] {
  const fee = paymentFeeFor(order.total);
  return [
    {
      account: "revenue",
      amount: r2(order.subtotal + order.discount),
      dedupe_key: `order:${order.external_id}:revenue`,
      memo: `Sale ${order.order_number}`,
      order_id: order.id,
      units: totalUnits(order),
      currency: order.currency,
      occurred_at: order.placed_at,
    },
    {
      account: "discount",
      amount: order.discount,
      dedupe_key: `order:${order.external_id}:discount`,
      memo: `Discounts on ${order.order_number}`,
      order_id: order.id,
      currency: order.currency,
      occurred_at: order.placed_at,
    },
    {
      account: "shipping_income",
      amount: order.shipping,
      dedupe_key: `order:${order.external_id}:shipping_income`,
      memo: `Shipping charged on ${order.order_number}`,
      order_id: order.id,
      currency: order.currency,
      occurred_at: order.placed_at,
    },
    {
      account: "tax",
      amount: order.tax,
      dedupe_key: `order:${order.external_id}:tax`,
      memo: `Sales tax collected on ${order.order_number}`,
      order_id: order.id,
      currency: order.currency,
      occurred_at: order.placed_at,
    },
    {
      account: "payment_fees",
      amount: fee,
      dedupe_key: `order:${order.external_id}:payment_fees`,
      memo: `Processing fee on ${order.order_number}`,
      order_id: order.id,
      currency: order.currency,
      occurred_at: order.placed_at,
    },
    {
      account: "cogs",
      amount: estimatedCogs(order),
      dedupe_key: `order:${order.external_id}:cogs`,
      memo: `Accrued COGS for ${order.order_number} (estimated at sale)`,
      order_id: order.id,
      currency: order.currency,
      occurred_at: order.placed_at,
    },
  ];
}

export interface IngestResult {
  order: Order;
  created: boolean;
  posted: number;
}

/**
 * Idempotently record a Shopify order. Re-delivery of the same webhook updates
 * the mutable fields (payment/fulfillment status, refunds) and re-posts nothing:
 * the ledger's dedupe keys make double-counting structurally impossible.
 */
export async function ingestShopifyOrder(
  orgId: string,
  payload: Record<string, unknown>,
  products: Product[],
  opts: { holdRisky: boolean; riskRecommendation?: string },
): Promise<IngestResult> {
  const mapped = mapShopifyOrder(orgId, payload, products);
  const existing = await findOrderByExternalId(orgId, mapped.external_id);

  if (existing) {
    // Never move an order backwards: once it's shipped or on the supplier's
    // conveyor, Shopify's view of it is not the authority on our stage.
    const terminal: OrderStage[] = ["awaiting_stock", "shipped", "delivered"];
    const classified = classifyOrder({ ...mapped, id: existing.id }, opts);
    const stage: OrderStage =
      mapped.stage === "cancelled"
        ? "cancelled"
        : terminal.includes(existing.stage)
          ? existing.stage
          : classified.stage;

    const updated = await updateOrder(
      orgId,
      existing.id,
      {
        financial_status: mapped.financial_status,
        fulfillment_status: mapped.fulfillment_status,
        refunded: mapped.refunded,
        stage,
        hold_reason: stage === "on_hold" ? classified.hold_reason : undefined,
      },
      { kind: "synced", detail: `Refreshed from Shopify (${mapped.financial_status || "unknown"}).` },
    );
    const posted = isPaid(mapped) ? await postEntries(orgId, saleEntries({ ...mapped, id: existing.id })) : 0;
    return { order: updated ?? existing, created: false, posted };
  }

  const classified = classifyOrder(mapped, opts);
  const order: Order = { ...mapped, stage: classified.stage, hold_reason: classified.hold_reason };
  if (classified.hold_reason) {
    order.events.push({ at: order.created_at, kind: "on_hold", detail: classified.hold_reason });
  }
  await saveOrder(order);

  const posted = isPaid(order) ? await postEntries(orgId, saleEntries(order)) : 0;
  return { order, created: true, posted };
}

/** Record a refund against an order and write it to the books. */
export async function recordRefund(
  orgId: string,
  externalOrderId: string,
  amount: number,
  refundId: string,
  reason = "",
): Promise<Order | null> {
  const order = await findOrderByExternalId(orgId, externalOrderId);
  if (!order) return null;
  const refunded = r2(order.refunded + Math.abs(amount));
  const fullyRefunded = refunded >= order.total - 0.01;

  await postEntries(orgId, [
    {
      account: "refunds",
      amount,
      dedupe_key: `refund:${refundId}`,
      memo: `Refund on ${order.order_number}${reason ? ` — ${reason}` : ""}`,
      order_id: order.id,
      currency: order.currency,
    },
  ]);

  const updated = await updateOrder(
    orgId,
    order.id,
    { refunded, stage: fullyRefunded ? "refunded" : order.stage },
    { kind: "refunded", detail: `Refunded $${Math.abs(amount).toFixed(2)}${reason ? ` — ${reason}` : ""}.` },
  );

  // If the goods were already bought, say so on the order itself — this is the
  // moment the loss becomes real, and it is the last point anyone is looking.
  if (updated && fullyRefunded && order.supplier_order_id) {
    return updateOrder(orgId, order.id, {}, {
      kind: "supplier_exposure",
      detail: order.tracking_number
        ? `Supplier order ${order.supplier_order_id} already shipped — $${(order.cogs + order.supplier_shipping).toFixed(2)} is unrecoverable.`
        : `Supplier order ${order.supplier_order_id} was already placed — cancel it to recover $${(order.cogs + order.supplier_shipping).toFixed(2)}.`,
    });
  }
  return updated;
}
