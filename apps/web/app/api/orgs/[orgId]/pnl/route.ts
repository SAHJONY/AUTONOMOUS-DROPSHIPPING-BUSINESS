import { json, requireOrg } from "@/lib/api";
import { getPnlSuite, listLedger } from "@/lib/ledger";
import { listOrders, productPerformance } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The books: every standard reporting window, the raw entries behind them, and
 * what each product earned. One endpoint, one set of numbers — this supersedes
 * the earlier standalone profit snapshot, which recomputed its own totals from
 * Shopify on every request and so could disagree with the ledger.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const [periods, entries, orders] = await Promise.all([
    getPnlSuite(orgId),
    listLedger(orgId, 100),
    listOrders(orgId, 500),
  ]);
  return json({
    periods,
    entries,
    top_products: productPerformance(orders, 30).slice(0, 10),
  });
}
