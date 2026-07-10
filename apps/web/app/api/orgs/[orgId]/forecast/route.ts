import { json, requireOrg } from "@/lib/api";
import { buildForecast } from "@/lib/forecast";
import { listProducts } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  const products = await listProducts(orgId);
  return json(buildForecast(products));
}
