import { error, json, requireOrgRole } from "@/lib/api";
import { runFulfillmentCycle, syncShopifyOrders } from "@/lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Pull orders from Shopify on demand.
 *
 * `{ "fulfill": true }` runs the full cycle instead: sync, buy the goods for
 * everything within the cost cap, and push tracking for anything that shipped.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  // Owner/admin only: `fulfill` buys goods from the supplier, so this is a
  // spending endpoint, not a read.
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => ({}))) as { fulfill?: boolean; days?: number };

  if (body.fulfill) {
    return json({ ok: true, cycle: await runFulfillmentCycle(orgId) });
  }

  const result = await syncShopifyOrders(orgId, { sinceDays: Number(body.days ?? 7) });
  if (!result.ok) return error(result.error ?? "Order sync failed.", 502);
  return json({ ok: true, imported: result.imported, updated: result.updated });
}
