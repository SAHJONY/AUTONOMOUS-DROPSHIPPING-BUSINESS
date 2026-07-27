import { error, json, requireOrgRole } from "@/lib/api";
import { decideApproval } from "@/lib/brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; id: string }> },
) {
  const { orgId, id } = await params;
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const decision = body.decision === "reject" ? "reject" : body.decision === "approve" ? "approve" : null;
  if (!decision) return error("decision must be 'approve' or 'reject'.", 422);

  try {
    const approval = await decideApproval(
      orgId,
      id,
      decision,
      auth.user.id,
      auth.role,
      String(body.reason ?? ""),
    );
    return json(approval);
  } catch (e) {
    const msg = (e as Error).message;
    return error(msg, msg.includes("not found") ? 404 : 409);
  }
}
