import { error, json, requireOrgRole } from "@/lib/api";
import { migrateShopifyToBotanicaCatalog } from "@/lib/botanica-shopify-migration";
import { resolveShopifyToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  if (body.confirmation !== "MIGRATE BOTANICA CATALOG") {
    return error("Type MIGRATE BOTANICA CATALOG to confirm the catalog migration.", 409);
  }

  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.shop || !resolved.token) {
    return error(resolved.error ?? "Shopify is not connected.", 503);
  }

  try {
    const result = await migrateShopifyToBotanicaCatalog(resolved.shop, resolved.token);
    return json({
      ok: result.ok,
      migration: "BOTANICA_OCHOSI_2026_08",
      shop: resolved.shop,
      ...result,
    }, result.ok ? 200 : 207);
  } catch (e) {
    return error((e as Error).message, 502);
  }
}
