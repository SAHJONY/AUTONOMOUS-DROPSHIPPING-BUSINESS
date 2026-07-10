import { error, json, requireOrg } from "@/lib/api";
import { clearCJCreds, getCJCreds, setCJCreds } from "@/lib/store";
import { cjGetAccessToken } from "@/lib/suppliers/cj";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  const creds = await getCJCreds(orgId);
  return json({ connected: !!creds, email: creds?.email ?? null });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  if (body.disconnect) {
    await clearCJCreds(orgId);
    return json({ connected: false });
  }

  const email = String(body.email ?? "").trim();
  const apiKey = String(body.api_key ?? "").trim();
  if (!email || !apiKey) return error("CJ account email and API key are required.", 422);

  const test = await cjGetAccessToken({ email, api_key: apiKey, connected_at: "" });
  if (!test.ok) return error(`Could not connect to CJ: ${test.error}`, 400);

  await setCJCreds(orgId, { email, api_key: apiKey, connected_at: new Date().toISOString() });
  return json({ connected: true, email });
}
