import { error, json, requireOrg } from "@/lib/api";
import { clearShopifyCreds, getShopifyCreds, setShopifyCreds } from "@/lib/store";
import { mintAccessToken, normalizeShop, testShopifyToken } from "@/lib/shopify";
import type { ShopifyCreds } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Connection status — never returns the secret. */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  const creds = await getShopifyCreds(orgId);
  return json({
    connected: !!creds,
    shop: creds?.shop ?? null,
    mode: creds?.token ? "token" : creds?.client_id ? "dev_dashboard" : null,
  });
}

/**
 * Connect or disconnect. Accepts either:
 *   { shop, client_id, client_secret }  — new Dev Dashboard app, OR
 *   { shop, token }                     — legacy custom app token.
 * Disconnect: { disconnect: true }.
 */
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
  if (!shop) return error("Store domain is required (e.g. your-store.myshopify.com).", 422);

  const token = String(body.token ?? "").trim();
  const clientId = String(body.client_id ?? "").trim();
  const clientSecret = String(body.client_secret ?? "").trim();

  let creds: ShopifyCreds;
  let activeToken: string;

  if (clientId && clientSecret) {
    const minted = await mintAccessToken(shop, clientId, clientSecret);
    if (!minted.ok || !minted.token) {
      return error(`Could not connect: ${minted.error}. Check the domain, Client ID, and Client Secret.`, 400);
    }
    activeToken = minted.token;
    creds = { shop, client_id: clientId, client_secret: clientSecret, connected_at: new Date().toISOString() };
  } else if (token) {
    activeToken = token;
    creds = { shop, token, connected_at: new Date().toISOString() };
  } else {
    return error("Provide Client ID + Client Secret (Dev Dashboard) or a legacy access token.", 422);
  }

  const test = await testShopifyToken(shop, activeToken);
  if (!test.ok) return error(`Connected to Shopify but the token was rejected: ${test.error}`, 400);

  await setShopifyCreds(orgId, creds);
  return json({ connected: true, shop, name: test.name });
}
