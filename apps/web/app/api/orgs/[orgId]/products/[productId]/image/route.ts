import { error, json, requireOrg } from "@/lib/api";
import { generateProductImage, syncProductImageToShopify } from "@/lib/store";

export const runtime = "nodejs";
// Higgsfield's API only accepts requests from European IPs — run in Frankfurt.
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Acquire a premium clean-white studio image (or a manual URL) and save it to
 * the product. If the product is already live on Shopify, the new image is also
 * pushed onto the live listing. Pass { premium: false } to keep the supplier's
 * own photo instead of generating one.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; productId: string }> },
) {
  const { orgId, productId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const manualUrl = typeof body.url === "string" ? body.url : undefined;
  const premium = body.premium === false ? false : true;

  const res = await generateProductImage(orgId, productId, manualUrl, { premium });
  if (!res.ok) return error(res.error ?? "Image acquisition failed.", 400);

  // Best-effort refresh of the live Shopify listing (no-op if not published).
  const sync = await syncProductImageToShopify(orgId, productId);
  return json({ ok: true, url: res.url, source: res.source, synced: sync.ok });
}
