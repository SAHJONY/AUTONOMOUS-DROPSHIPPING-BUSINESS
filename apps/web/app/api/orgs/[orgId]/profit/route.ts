import { error, json, requireOrg } from "@/lib/api";
import { buildProfitSnapshot } from "@/lib/profit";
import { listProducts, resolveShopifyToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.shop || !resolved.token) {
    return error(resolved.error ?? "Connect Shopify before loading profit intelligence.", 409);
  }

  const url = new URL(req.url);
  const requestedDays = Number(url.searchParams.get("days") ?? 30);
  const days = Number.isFinite(requestedDays) ? requestedDays : 30;

  try {
    const snapshot = await buildProfitSnapshot({
      shop: resolved.shop,
      token: resolved.token,
      products: await listProducts(orgId),
      days,
    });
    return json(snapshot);
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Unable to load Shopify performance.", 502);
  }
}
