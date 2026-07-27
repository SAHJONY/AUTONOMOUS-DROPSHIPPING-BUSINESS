import { json, requireOrgRole } from "@/lib/api";
import {
  ANTHROPIC_API_KEY,
  AUTONOMY_ENABLED,
  COMMERCE_RELEASE_ENABLED,
  CRON_SECRET,
  JWT_SECRET,
  PUBLIC_BASE_URL,
  SHOPIFY_WEBHOOK_SECRET,
} from "@/lib/config";
import { STORAGE_MODE } from "@/lib/kv";
import { assessReadiness } from "@/lib/readiness";
import { getCJCreds, getOrgSettings, getShopifyCreds } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The default baked into config.ts — public in the source, so unusable in production. */
const DEFAULT_JWT_SECRET = "change-me-in-production-commerce-os";

/**
 * Go-live preflight for this deployment.
 *
 * Owner/admin only, and deliberately reports *whether* each secret is set rather
 * than any value — this endpoint exists to make configuration mistakes visible,
 * not to expose the configuration itself.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;

  const [shopify, cj, settings] = await Promise.all([
    getShopifyCreds(orgId),
    getCJCreds(orgId),
    getOrgSettings(orgId),
  ]);

  return json(
    assessReadiness({
      storageMode: STORAGE_MODE,
      jwtSecretIsDefault: JWT_SECRET === DEFAULT_JWT_SECRET,
      cronSecretSet: !!CRON_SECRET,
      engineKeySet: !!ANTHROPIC_API_KEY,
      webhookSecretSet: !!SHOPIFY_WEBHOOK_SECRET,
      publicBaseUrlSet: !!PUBLIC_BASE_URL,
      shopifyConnected: !!shopify,
      cjConnected: !!cj,
      autonomyEnabled: AUTONOMY_ENABLED,
      commerceReleaseEnabled: COMMERCE_RELEASE_ENABLED,
      autoFulfillEnabled: settings.auto_fulfill,
    }),
  );
}
