import { error, json } from "@/lib/api";
import { CRON_SECRET } from "@/lib/config";
import { migrateShopifyToBotanicaCatalog } from "@/lib/botanica-shopify-migration";
import { listAllOrgs, resolveShopifyToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Owner-authorized catalog migration endpoint.
 * Protected by CRON_SECRET so it can be invoked by the repository's manual
 * GitHub Actions workflow without exposing Shopify credentials.
 *
 * Safe semantics:
 * - archives legacy products instead of hard deleting order-linked history;
 * - creates curated BOTANICA products as unpublished drafts;
 * - is idempotent: existing BOTANICA titles are not duplicated;
 * - never invents price or inventory.
 */
async function handle(req: Request) {
  if (!CRON_SECRET) return error("Catalog migration is disabled: CRON_SECRET is not configured.", 503);
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${CRON_SECRET}`) return error("Unauthorized", 401);

  const orgs = await listAllOrgs();
  const results: Record<string, unknown>[] = [];

  for (const org of orgs) {
    const resolved = await resolveShopifyToken(org.id);
    if (!resolved.ok || !resolved.shop || !resolved.token) {
      results.push({ org_id: org.id, org_name: org.name, skipped: true, reason: resolved.error ?? "Shopify unavailable" });
      continue;
    }
    try {
      const result = await migrateShopifyToBotanicaCatalog(resolved.shop, resolved.token);
      results.push({ org_id: org.id, org_name: org.name, shop: resolved.shop, ...result });
    } catch (e) {
      results.push({ org_id: org.id, org_name: org.name, shop: resolved.shop, ok: false, errors: [(e as Error).message] });
    }
  }

  return json({ migration: "BOTANICA_OCHOSI_2026_08", orgs: results });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
