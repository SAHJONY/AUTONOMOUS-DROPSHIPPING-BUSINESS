import { json, requireOrgRole } from "@/lib/api";
import { syncBotanicaShopifyCollections } from "@/lib/botanica/shopify-collections";
import { resolveShopifyToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.shop || !resolved.token) {
    return json(
      {
        ok: false,
        error: resolved.error ?? "Shopify is not connected.",
        action_required: "Connect Shopify credentials before syncing BOTANICA OCHOSI collections.",
      },
      409,
    );
  }

  const result = await syncBotanicaShopifyCollections(resolved.shop, resolved.token);
  return json({
    ...result,
    brand: "BOTANICA OCHOSI",
    store: resolved.shop,
    governance: {
      owner_only: true,
      deletes_existing_collections: false,
      auto_publish_products: false,
      autonomous_purchase: false,
    },
  }, result.ok ? 200 : 502);
}
