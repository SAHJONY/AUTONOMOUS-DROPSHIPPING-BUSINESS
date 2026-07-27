import { json, requireOrg } from "@/lib/api";
import { autoApprovePending } from "@/lib/brain";
import { getOrgSettings, setOrgSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  return json(await getOrgSettings(orgId));
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({}));
  const patch: { autopilot?: boolean; auto_publish?: boolean; auto_fulfill?: boolean } = {};
  if (typeof body.autopilot === "boolean") patch.autopilot = body.autopilot;
  if (typeof body.auto_publish === "boolean") patch.auto_publish = body.auto_publish;
  if (typeof body.auto_fulfill === "boolean") patch.auto_fulfill = body.auto_fulfill;
  const settings = await setOrgSettings(orgId, patch);
  // Turning autopilot on immediately clears any within-threshold approvals.
  if (settings.autopilot) await autoApprovePending(orgId);
  return json(settings);
}
