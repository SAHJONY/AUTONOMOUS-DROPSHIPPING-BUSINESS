import { error, json, requireOrgRole } from "@/lib/api";
import {
  generateProductImage,
  getHiggsfieldCreds,
  listProducts,
  resolveShopifyToken,
  updateProduct,
} from "@/lib/store";
import { createShopifyProduct } from "@/lib/shopify";

export const runtime = "nodejs";
// Higgsfield's API only accepts requests from European IPs — run in Frankfurt.
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Publish a product to the connected Shopify store. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; productId: string }> },
) {
  const { orgId, productId } = await params;
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;

  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.token || !resolved.shop) {
    return error(resolved.error ?? "No Shopify store connected. Connect one first.", 400);
  }

  const product = (await listProducts(orgId)).find((p) => p.id === productId);
  if (!product) return error("Product not found", 404);

  // Generate a premium clean-white studio image when Higgsfield is connected
  // (refreshing supplier scrapes), else keep whatever image the product has.
  let imageUrl = product.image_url;
  if (await getHiggsfieldCreds(orgId)) {
    const img = await generateProductImage(orgId, productId, undefined, { premium: true });
    if (img.ok) imageUrl = img.url;
  }

  const result = await createShopifyProduct(resolved.shop, resolved.token, {
    title: product.title,
    description: product.description,
    price: product.price,
    image_url: imageUrl,
    images: product.images,
    video_url: product.video_url,
  });
  if (!result.ok) return error(`Publish failed: ${result.error}`, 502);

  const updated = await updateProduct(orgId, productId, {
    status: "launched",
    storefront_url: result.url ?? "",
    shopify_id: result.id,
    shopify_handle: result.handle,
  });
  return json({ ok: true, url: result.url, product: updated });
}
