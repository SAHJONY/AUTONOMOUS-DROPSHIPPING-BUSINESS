import { error, json, requireOrg } from "@/lib/api";
import { listProducts, resolveShopifyToken, updateProduct } from "@/lib/store";
import { createShopifyProduct } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Publish a product to the connected Shopify store. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; productId: string }> },
) {
  const { orgId, productId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.token || !resolved.shop) {
    return error(resolved.error ?? "No Shopify store connected. Connect one first.", 400);
  }

  const product = (await listProducts(orgId)).find((p) => p.id === productId);
  if (!product) return error("Product not found", 404);

  const result = await createShopifyProduct(resolved.shop, resolved.token, {
    title: product.title,
    description: product.description,
    price: product.price,
  });
  if (!result.ok) return error(`Publish failed: ${result.error}`, 502);

  const updated = await updateProduct(orgId, productId, {
    status: "launched",
    storefront_url: result.url ?? "",
  });
  return json({ ok: true, url: result.url, product: updated });
}
