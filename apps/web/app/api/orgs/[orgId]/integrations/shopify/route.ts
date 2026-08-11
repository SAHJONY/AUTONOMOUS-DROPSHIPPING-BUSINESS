import { error, json, requireOrg, requireOrgRole } from "@/lib/api";
import { PUBLIC_BASE_URL, SHOPIFY_WEBHOOK_SECRET } from "@/lib/config";
import {
  clearShopifyCreds,
  getShopifyCreds,
  resolveShopifyToken,
  setShopifyCreds,
} from "@/lib/store";
import {
  mintAccessToken,
  normalizeShop,
  registerShopifyWebhooks,
  testShopifyToken,
} from "@/lib/shopify";
import type { ShopifyCreds } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Connection status — never returns a secret.
 *
 * A stored credential record is not enough to claim Shopify is connected.
 * We resolve a usable Admin API token and probe Shopify on every owner status
 * request. This keeps Owner OS truthful when a token expires, credentials are
 * incomplete, or Shopify rejects access.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const creds = await getShopifyCreds(orgId);
  if (!creds?.shop) {
    return json({
      connected: false,
      status: "not_configured",
      shop: null,
      mode: null,
      verified_at: null,
      detail: "No Shopify credentials are configured for this organization.",
    });
  }

  const mode = creds.token ? "token" : creds.client_id ? "dev_dashboard" : null;
  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.token || !resolved.shop) {
    return json({
      connected: false,
      status: "credentials_stale",
      shop: creds.shop,
      mode,
      verified_at: new Date().toISOString(),
      detail: resolved.error ?? "Shopify credentials could not be resolved.",
    });
  }

  const probe = await testShopifyToken(resolved.shop, resolved.token);
  if (!probe.ok) {
    return json({
      connected: false,
      status: "credentials_stale",
      shop: resolved.shop,
      mode,
      verified_at: new Date().toISOString(),
      detail: probe.error ?? "Shopify rejected the Admin API credential.",
    });
  }

  return json({
    connected: true,
    status: "verified",
    shop: resolved.shop,
    store_name: probe.name ?? null,
    mode,
    verified_at: new Date().toISOString(),
    detail: "Shopify Admin API verified successfully.",
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
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  if (body.disconnect) {
    await clearShopifyCreds(orgId);
    return json({ connected: false, status: "not_configured", shop: null });
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

  const webhooks = await subscribeToOrderFeed(orgId);

  return json({
    connected: true,
    status: "verified",
    shop,
    name: test.name,
    verified_at: new Date().toISOString(),
    webhooks,
  });
}

/**
 * Register (or refresh) this store's order webhooks. Reported rather than
 * enforced: a store with no public callback URL or no webhook secret still
 * connects fine and falls back to the polling sync in the fulfillment cron.
 */
async function subscribeToOrderFeed(orgId: string) {
  if (!PUBLIC_BASE_URL) {
    return { registered: false, reason: "PUBLIC_BASE_URL is not set — using polling sync instead." };
  }
  if (!SHOPIFY_WEBHOOK_SECRET) {
    return {
      registered: false,
      reason: "SHOPIFY_WEBHOOK_SECRET is not set — deliveries could not be verified, using polling sync instead.",
    };
  }
  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.token || !resolved.shop) {
    return { registered: false, reason: resolved.error ?? "Could not resolve an admin token." };
  }
  const result = await registerShopifyWebhooks(
    resolved.shop,
    resolved.token,
    `${PUBLIC_BASE_URL}/api/webhooks/shopify`,
  );
  return {
    registered: result.ok,
    created: result.created,
    existing: result.existing,
    errors: result.errors,
  };
}
