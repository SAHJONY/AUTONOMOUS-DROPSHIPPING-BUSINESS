import { error, json, requireOrg, requireOrgRole } from "@/lib/api";
import { COMMERCE_RELEASE_ENABLED } from "@/lib/config";
import { publishProductToShopify } from "@/lib/store";

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
  // Gate order is deliberate and asserted by the governance suite: membership
  // first (404 for outsiders), then the release gate (423), then role (403).
  const membership = await requireOrg(req, orgId);
  if ("response" in membership) return membership.response;
  if (!COMMERCE_RELEASE_ENABLED) {
    return error("Commerce publishing is locked until the commerce safety release is approved.", 423);
  }
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;

  const result = await publishProductToShopify(orgId, productId);
  if (!result.ok) return error(result.error ?? "Publish failed.", 502);
  return json({ ok: true, url: result.url, product: result.product });
}
