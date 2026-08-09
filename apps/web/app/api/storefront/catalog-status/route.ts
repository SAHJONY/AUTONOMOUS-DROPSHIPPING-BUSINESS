import { json } from "@/lib/api";
import { isBotanicaManagedProduct, listShopifyCatalog } from "@/lib/botanica-shopify-migration";
import { listAllOrgs, resolveShopifyToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public-safe catalog migration status: counts only, no credentials or supplier economics. */
export async function GET() {
  const orgs = await listAllOrgs();
  const results: Record<string, unknown>[] = [];

  for (const org of orgs) {
    const resolved = await resolveShopifyToken(org.id);
    if (!resolved.ok || !resolved.shop || !resolved.token) continue;
    try {
      const products = await listShopifyCatalog(resolved.shop, resolved.token);
      const botanica = products.filter(isBotanicaManagedProduct);
      const legacy = products.filter((p) => !isBotanicaManagedProduct(p));
      results.push({
        shop: resolved.shop,
        total_products: products.length,
        botanica_total: botanica.length,
        botanica_draft: botanica.filter((p) => p.status === "draft").length,
        botanica_active: botanica.filter((p) => p.status === "active").length,
        botanica_archived: botanica.filter((p) => p.status === "archived").length,
        legacy_active_or_draft: legacy.filter((p) => p.status !== "archived").length,
        legacy_archived: legacy.filter((p) => p.status === "archived").length,
      });
    } catch {
      results.push({ shop: resolved.shop, unavailable: true });
    }
  }

  return json({ catalogs: results });
}
