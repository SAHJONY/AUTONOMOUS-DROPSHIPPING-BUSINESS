import { error, json, requireOrg } from "@/lib/api";
import { clearShopifyCreds, getShopifyCreds, setShopifyCreds } from "@/lib/store";
import { normalizeShop, testShopify } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Connection status — never returns the secret token. */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  const creds = await getShopifyCreds(orgId);
  return json({ connected: !!creds, shop: creds?.shop ?? null });
}

/** Connect (validates the token) or disconnect (body: { disconnect: true }). */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  if (body.disconnect) {
    await clearShopifyCreds(orgId);
    return json({ connected: false, shop: null });
  }

  const shop = normalizeShop(String(body.shop ?? ""));
  const token = String(body.token ?? "").trim();
  if (!shop || !token) return error("Shop domain and access token are required.", 422);

  const test = await testShopify({ shop, token, connected_at: "" });
  if (!test.ok) return error(`Could not connect: ${test.error}`, 400);

  await setShopifyCreds(orgId, { shop, token, connected_at: new Date().toISOString() });
  return json({ connected: true, shop, name: test.name });
}
