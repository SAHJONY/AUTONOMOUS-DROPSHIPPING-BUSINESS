import { json, requireOrg } from "@/lib/api";
import { listStores } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  return json(await listStores(orgId));
}
