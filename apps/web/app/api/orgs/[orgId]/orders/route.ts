import { json, requireOrg } from "@/lib/api";
import { listOrders } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The order book. Optionally filtered to one pipeline stage. */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const stage = new URL(req.url).searchParams.get("stage") ?? "";
  const orders = await listOrders(orgId, 200);
  return json(stage ? orders.filter((o) => o.stage === stage) : orders);
}
