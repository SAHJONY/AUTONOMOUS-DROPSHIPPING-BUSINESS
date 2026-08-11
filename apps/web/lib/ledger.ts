/**
 * The books.
 *
 * Every dollar that moves through the business gets a signed ledger entry:
 * positive is money in, negative is money out. The P&L is derived from these
 * entries and nothing else, so what the dashboard reports is what actually
 * happened — not an estimate from the catalog.
 *
 * Postings are idempotent. Each entry carries a `dedupe_key` derived from what
 * it represents (`order:1234:revenue`), so replaying a Shopify webhook, re-running
 * a sync, or retrying a failed fulfillment can never double-count revenue.
 */
import { kv, listGet, listPush, listReplace } from "./kv";
import { PAYMENT_FEE_FIXED, PAYMENT_FEE_RATE } from "./config";
import type { LedgerAccount, LedgerEntry, ProfitAndLoss } from "./types";

const LEDGER_CAP = 5000;

const key = (orgId: string) => `ledger:${orgId}`;
const dedupeIndexKey = (orgId: string) => `ledger:keys:${orgId}`;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Accounts that represent money leaving the business, whatever sign is passed in. */
const OUTFLOW_ACCOUNTS: ReadonlySet<LedgerAccount> = new Set<LedgerAccount>([
  "discount",
  "cogs",
  "supplier_shipping",
  "payment_fees",
  "refunds",
  "ad_spend",
  "opex",
]);

/** Normalize an amount to the sign its account requires. Callers may pass either. */
export function normalizeAmount(account: LedgerAccount, amount: number): number {
  const magnitude = Math.abs(Number(amount) || 0);
  return OUTFLOW_ACCOUNTS.has(account) ? -magnitude : magnitude;
}

export interface PostInput {
  account: LedgerAccount;
  amount: number;
  dedupe_key: string;
  memo?: string;
  currency?: string;
  order_id?: string;
  product_id?: string;
  units?: number;
  occurred_at?: string;
  /**
   * Post `amount` exactly as given instead of forcing it to the account's usual
   * direction. Used for true-ups and reversals, where a cost entry legitimately
   * moves the other way (the supplier charged less than we estimated).
   */
  signed?: boolean;
}

/**
 * Post one entry. Returns null when an entry with the same dedupe key already
 * exists — the caller's work was already recorded, which is a success, not an error.
 */
export async function postEntry(orgId: string, input: PostInput): Promise<LedgerEntry | null> {
  const seen = await kv.get<string[]>(dedupeIndexKey(orgId));
  const index = new Set(seen ?? []);
  if (index.has(input.dedupe_key)) return null;

  const entry: LedgerEntry = {
    id: crypto.randomUUID().replace(/-/g, ""),
    org_id: orgId,
    account: input.account,
    amount: r2(input.signed ? Number(input.amount) || 0 : normalizeAmount(input.account, input.amount)),
    currency: input.currency ?? "USD",
    order_id: input.order_id,
    product_id: input.product_id,
    units: input.units,
    memo: input.memo ?? "",
    dedupe_key: input.dedupe_key,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  // Zero-value entries still claim their dedupe key (so a $0 shipping charge
  // doesn't get retried forever) but don't clutter the ledger.
  if (entry.amount !== 0) await listPush(key(orgId), entry, LEDGER_CAP);

  index.add(input.dedupe_key);
  // Keep the dedupe index bounded in step with the ledger itself.
  const trimmed = [...index].slice(-LEDGER_CAP * 2);
  await kv.set(dedupeIndexKey(orgId), trimmed);
  return entry;
}

/** Post several entries as a batch, skipping any that were already recorded. */
export async function postEntries(orgId: string, inputs: PostInput[]): Promise<number> {
  let posted = 0;
  for (const input of inputs) {
    const entry = await postEntry(orgId, input);
    if (entry) posted++;
  }
  return posted;
}

export async function listLedger(orgId: string, limit = 200): Promise<LedgerEntry[]> {
  return (await listGet<LedgerEntry>(key(orgId))).slice(0, limit);
}

/** Drop every entry tied to an order — used when an order is deleted outright. */
export async function reverseOrderEntries(orgId: string, orderId: string): Promise<number> {
  const entries = await listGet<LedgerEntry>(key(orgId));
  const kept = entries.filter((e) => e.order_id !== orderId);
  const removed = entries.length - kept.length;
  if (removed) await listReplace(key(orgId), kept);
  return removed;
}

/**
 * Payment processor cost for an order. Shopify's order payload doesn't include
 * the processing fee, so we model it at the standard online rate. Both the rate
 * and the fixed component are configurable per deployment.
 */
export function paymentFeeFor(orderTotal: number): number {
  if (orderTotal <= 0) return 0;
  return r2(orderTotal * PAYMENT_FEE_RATE + PAYMENT_FEE_FIXED);
}

/* ---------- P&L ---------- */

export type PeriodKey = "today" | "7d" | "30d" | "90d" | "all";

const PERIODS: Record<PeriodKey, { label: string; days: number | null }> = {
  today: { label: "Today", days: 1 },
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  all: { label: "All time", days: null },
};

export function periodBounds(period: PeriodKey, now = new Date()): { from: Date; to: Date } {
  const cfg = PERIODS[period] ?? PERIODS["30d"];
  if (cfg.days === null) return { from: new Date(0), to: now };
  if (period === "today") {
    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    return { from, to: now };
  }
  return { from: new Date(now.getTime() - cfg.days * 86_400_000), to: now };
}

/**
 * Build a P&L from ledger entries. `orders` and `units` are counted from the
 * revenue entries themselves so the statement stays self-consistent even if the
 * order list has been trimmed.
 */
export function buildPnl(
  entries: LedgerEntry[],
  period: PeriodKey = "30d",
  now = new Date(),
): ProfitAndLoss {
  const { from, to } = periodBounds(period, now);
  const inWindow = entries.filter((e) => {
    const at = new Date(e.occurred_at).getTime();
    return at >= from.getTime() && at <= to.getTime();
  });

  const byAccount: Record<string, number> = {};
  for (const e of inWindow) byAccount[e.account] = r2((byAccount[e.account] ?? 0) + e.amount);

  const abs = (account: LedgerAccount) => Math.abs(byAccount[account] ?? 0);

  const grossRevenue = byAccount.revenue ?? 0;
  const shippingIncome = byAccount.shipping_income ?? 0;
  const discounts = abs("discount");
  const refunds = abs("refunds");
  const cogs = abs("cogs");
  const supplierShipping = abs("supplier_shipping");
  const paymentFees = abs("payment_fees");
  const adSpend = abs("ad_spend");
  const opex = abs("opex");
  const taxCollected = byAccount.tax ?? 0;

  const netRevenue = grossRevenue + shippingIncome - discounts - refunds;
  const grossProfit = netRevenue - cogs - supplierShipping - paymentFees;
  const netProfit = grossProfit - adSpend - opex;

  const orderIds = new Set(
    inWindow.filter((e) => e.account === "revenue" && e.order_id).map((e) => e.order_id as string),
  );
  const orders = orderIds.size;
  const units = inWindow
    .filter((e) => e.account === "revenue")
    .reduce((sum, e) => sum + (Number(e.units) || 0), 0);

  return {
    period: { key: period, label: PERIODS[period]?.label ?? period, from: from.toISOString(), to: to.toISOString() },
    orders,
    units,
    gross_revenue: r2(grossRevenue),
    shipping_income: r2(shippingIncome),
    discounts: r2(discounts),
    refunds: r2(refunds),
    net_revenue: r2(netRevenue),
    cogs: r2(cogs),
    supplier_shipping: r2(supplierShipping),
    payment_fees: r2(paymentFees),
    gross_profit: r2(grossProfit),
    ad_spend: r2(adSpend),
    opex: r2(opex),
    net_profit: r2(netProfit),
    gross_margin_pct: netRevenue > 0 ? r2((grossProfit / netRevenue) * 100) : 0,
    net_margin_pct: netRevenue > 0 ? r2((netProfit / netRevenue) * 100) : 0,
    aov: orders > 0 ? r2((grossRevenue + shippingIncome - discounts) / orders) : 0,
    profit_per_order: orders > 0 ? r2(netProfit / orders) : 0,
    tax_collected: r2(taxCollected),
    by_account: byAccount,
  };
}

/** Load the ledger and produce the statement for a period. */
export async function getPnl(orgId: string, period: PeriodKey = "30d"): Promise<ProfitAndLoss> {
  return buildPnl(await listGet<LedgerEntry>(key(orgId)), period);
}

/** All five standard windows at once — what the command deck renders. */
export async function getPnlSuite(orgId: string): Promise<Record<PeriodKey, ProfitAndLoss>> {
  const entries = await listGet<LedgerEntry>(key(orgId));
  return {
    today: buildPnl(entries, "today"),
    "7d": buildPnl(entries, "7d"),
    "30d": buildPnl(entries, "30d"),
    "90d": buildPnl(entries, "90d"),
    all: buildPnl(entries, "all"),
  };
}
