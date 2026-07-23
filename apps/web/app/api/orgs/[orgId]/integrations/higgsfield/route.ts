import { error, json, requireOrg, requireOrgRole } from "@/lib/api";
import { clearHiggsfieldCreds, getHiggsfieldCreds, setHiggsfieldCreds } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status — never returns the secret. */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  const creds = await getHiggsfieldCreds(orgId);
  return json({ connected: !!creds });
}

/** Connect ({ key_id, key_secret }) or disconnect ({ disconnect: true }). */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  if (body.disconnect) {
    await clearHiggsfieldCreds(orgId);
    return json({ connected: false });
  }

  const keySecret = String(body.key_secret ?? "").trim();
  const keyId = String(body.key_id ?? "").trim();
  if (!keySecret) return error("A Higgsfield API key (secret) is required.", 422);

  await setHiggsfieldCreds(orgId, { key_id: keyId, key_secret: keySecret, connected_at: new Date().toISOString() });
  return json({ connected: true });
}
