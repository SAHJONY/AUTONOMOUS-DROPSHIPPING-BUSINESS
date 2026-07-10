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

  const res = await generateProductImage(orgId, productId);
  if (!res.ok) return error(res.error ?? "Image generation failed.", 400);
  return json({ ok: true, url: res.url });
}
