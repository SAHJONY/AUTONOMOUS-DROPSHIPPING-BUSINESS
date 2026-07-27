import { error, json, requireOrg } from "@/lib/api";
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
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const result = await publishProductToShopify(orgId, productId);
  if (!result.ok) return error(result.error ?? "Publish failed.", 502);
  return json({ ok: true, url: result.url, product: result.product });
}
