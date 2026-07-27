import { error, json, requireOrgRole } from "@/lib/api";
import { reimageCatalog, reimageProduct } from "@/lib/store";

export const runtime = "nodejs";
// Higgsfield's API only accepts requests from European IPs — run in Frankfurt.
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
// Regenerating a whole catalog can take a while (one AI image per product).
export const maxDuration = 300;

/**
 * Premiumize product imagery in clean-white Amazon/Apple studio style.
 *   - { productId }  → reimage a single product (and refresh it live).
 *   - { onlyLive }   → only touch products already published to Shopify.
 *   - (no body)      → reimage the entire catalog.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));

  if (typeof body.productId === "string" && body.productId) {
    const res = await reimageProduct(orgId, body.productId);
    if (!res.ok) return error(res.error ?? "Reimage failed.", 400);
    return json({ ok: true, url: res.url, synced: res.synced });
  }

  const summary = await reimageCatalog(orgId, { onlyLive: body.onlyLive === true });
  return json({ ok: true, ...summary });
}
