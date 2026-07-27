import { error, json, requireOrg } from "@/lib/api";
import { placeSupplierOrder, pushFulfillment, syncTracking } from "@/lib/fulfillment";
import { estimatedCogs, getOrder, updateOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string; orderId: string }> },
) {
  const { orgId, orderId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const order = await getOrder(orgId, orderId);
  if (!order) return error("Order not found", 404);
  return json({ ...order, estimated_cogs: estimatedCogs(order) });
}

/**
 * Drive one order forward by hand.
 *
 * - `place`   buy the goods at the supplier. The owner calling this *is* the
 *             approval, so the autonomous cost cap does not apply.
 * - `track`   ask the supplier for tracking and ship it if there is any.
 * - `ship`    push the tracking we already have to Shopify.
 * - `release` clear a hold and put the order back in the queue.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; orderId: string }> },
) {
  const { orgId, orderId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const order = await getOrder(orgId, orderId);
  if (!order) return error("Order not found", 404);

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  switch (body.action) {
    case "place": {
      const result = await placeSupplierOrder(orgId, orderId, { bypassCostCap: true });
      return json({ ok: result.ok, detail: result.detail, order: await getOrder(orgId, orderId) });
    }
    case "track": {
      const result = await syncTracking(orgId, orderId);
      return json({ ok: result.ok, detail: result.detail, order: await getOrder(orgId, orderId) });
    }
    case "ship": {
      const result = await pushFulfillment(orgId, orderId);
      return json({ ok: result.ok, detail: result.detail, order: await getOrder(orgId, orderId) });
    }
    case "release": {
      const updated = await updateOrder(
        orgId,
        orderId,
        { stage: "received", hold_reason: undefined },
        { kind: "released", detail: `Hold cleared by ${auth.user.email}.` },
      );
      return json({ ok: true, detail: "Hold cleared — back in the fulfillment queue.", order: updated });
    }
    default:
      return error("Unknown action. Use place, track, ship, or release.", 422);
  }
}
