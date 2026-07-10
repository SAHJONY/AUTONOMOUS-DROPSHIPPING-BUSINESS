import { error, json, requireOrg } from "@/lib/api";
import { generateProductImage } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Generate a cinematic product image via Higgsfield and save it to the product. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; productId: string }> },
) {
  const { orgId, productId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const manualUrl = typeof body.url === "string" ? body.url : undefined;

  const res = await generateProductImage(orgId, productId, manualUrl);
  if (!res.ok) return error(res.error ?? "Image acquisition failed.", 400);
  return json({ ok: true, url: res.url, source: res.source });
}
