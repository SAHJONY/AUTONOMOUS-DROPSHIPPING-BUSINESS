import { json, requireOrg } from "@/lib/api";
import { buildForecast } from "@/lib/forecast";
import { getPnl } from "@/lib/ledger";
import { listProducts } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  // Fit the projection to real trading when there is any, and fall back to
  // catalog economics before the first orders land.
  const [products, pnl] = await Promise.all([listProducts(orgId), getPnl(orgId, "90d")]);
  return json(buildForecast(products, pnl));
}
