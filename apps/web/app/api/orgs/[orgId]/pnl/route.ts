import { json, requireOrg } from "@/lib/api";
import { getPnlSuite, listLedger } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The books: every standard reporting window plus the raw entries behind them. */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const [periods, entries] = await Promise.all([getPnlSuite(orgId), listLedger(orgId, 100)]);
  return json({ periods, entries });
}
