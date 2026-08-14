import { json, requireOrgRole } from "@/lib/api";
import { listGet } from "@/lib/kv";
import { getNativeStoreSettings } from "@/lib/native-commerce";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner", "admin"]);
  if ("response" in auth) return auth.response;
  const [settings, products] = await Promise.all([getNativeStoreSettings(orgId), listGet<Product>(`products:${orgId}`)]);
  const active = products.filter((product) => product.status === "launched" && product.price > 0);
  const completeShipping = active.filter((product) => (product.shipping_weight_oz ?? 0) > 0 && (product.package_length_in ?? 0) > 0 && (product.package_width_in ?? 0) > 0 && (product.package_height_in ?? 0) > 0).length;
  const completeSource = active.filter((product) => Boolean(product.supplier && (product.reorder_url || product.supplier_url) && product.supplier_sku)).length;
  const withImages = active.filter((product) => Boolean(product.image_url || product.images?.length)).length;
  return json({
    checks: [
      { id:"stripe", ready:Boolean(process.env.STRIPE_SECRET_KEY), label:"Stripe secret key" },
      { id:"webhook", ready:Boolean(process.env.STRIPE_WEBHOOK_SECRET), label:"Stripe webhook signature" },
      { id:"media", ready:Boolean(process.env.BLOB_READ_WRITE_TOKEN), label:"Image storage" },
      { id:"support", ready:Boolean(settings.supportEmail), label:"Customer support email" },
      { id:"catalog", ready:active.length >= 1, label:"At least one sellable product" },
      { id:"images", ready:active.length > 0 && withImages === active.length, label:`Images on active products (${withImages}/${active.length})` },
      { id:"shipping", ready:active.length > 0 && completeShipping === active.length, label:`Shipping data complete (${completeShipping}/${active.length})` },
      { id:"source", ready:active.length > 0 && completeSource === active.length, label:`Reorder source complete (${completeSource}/${active.length})` },
    ],
    activeProducts: active.length,
  });
}
