import { error, json, requireOrgRole } from "@/lib/api";
import { listGet, listReplace } from "@/lib/kv";
import { newId, nowISO } from "@/lib/store";
import type { Product } from "@/lib/types";
import { isBotanicaStoreCategory } from "@/lib/botanica-store-categories";
import {
  ownerArchiveShopifyProduct,
  ownerCreateShopifyProduct,
  ownerDeleteShopifyProduct,
  listAllOwnerShopifyProducts,
  mergeShopifyCatalogIntoProducts,
} from "@/lib/owner-catalog-shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const productsKey = (orgId: string) => `products:${orgId}`;

async function requireOwner(req: Request, orgId: string) {
  return requireOrgRole(req, orgId, ["owner"]);
}

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOwner(req, orgId);
  if ("response" in auth) return auth.response;
  const internal = await listGet<Product>(productsKey(orgId));
  try {
    const shopify = await listAllOwnerShopifyProducts(orgId);
    const merged = mergeShopifyCatalogIntoProducts(orgId, shopify.shop, internal, shopify.products);
    await listReplace(productsKey(orgId), merged);
    return json(merged, 200, {
      "X-Shopify-Sync": "complete",
      "X-Shopify-Products": String(shopify.products.length),
    });
  } catch (syncError) {
    console.error("Owner Shopify catalog sync failed", syncError);
    return json(internal, 200, { "X-Shopify-Sync": "failed" });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOwner(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return error("Product title is required.", 422);
  const syncShopify = body.sync_shopify !== false;
  const publish = body.publish === true;
  const price = Math.max(0, Number(body.price ?? 0));
  const cost = Math.max(0, Number(body.cost ?? 0));
  const category = String(body.product_type ?? "").trim();
  if (!isBotanicaStoreCategory(category)) return error("Choose a valid store category.", 422);
  if (publish && price <= 0) return error("A positive price is required before publishing.", 422);

  let shopify: Awaited<ReturnType<typeof ownerCreateShopifyProduct>> | undefined;
  if (syncShopify) {
    try {
      shopify = await ownerCreateShopifyProduct(orgId, {
        title,
        description: String(body.description ?? ""),
        price,
        sku: String(body.sku ?? "").trim() || undefined,
        productType: category,
        imageUrls: Array.isArray(body.images) ? body.images.map(String) : [],
        publish,
      });
    } catch (e) {
      return error((e as Error).message, 502);
    }
  }

  const product: Product = {
    id: newId(),
    org_id: orgId,
    title,
    description: String(body.description ?? ""),
    category,
    source: "owner_manual",
    supplier_url: String(body.supplier_url ?? ""),
    supplier: String(body.supplier ?? ""),
    supplier_sku: String(body.supplier_sku ?? "").trim().slice(0, 180) || undefined,
    supplier_contact: String(body.supplier_contact ?? "").trim().slice(0, 500) || undefined,
    country_of_origin: String(body.country_of_origin ?? "").trim().slice(0, 120) || undefined,
    provenance_notes: String(body.provenance_notes ?? "").trim().slice(0, 3000) || undefined,
    reorder_url: String(body.reorder_url ?? body.supplier_url ?? "").trim().slice(0, 1000) || undefined,
    reorder_moq: Math.max(1, Math.floor(Number(body.reorder_moq) || 1)),
    reorder_case_pack: Math.max(1, Math.floor(Number(body.reorder_case_pack) || 1)),
    reorder_lead_time_days: Math.max(0, Math.floor(Number(body.reorder_lead_time_days) || 0)),
    provenance_verified_at: String(body.provenance_verified_at ?? "").trim().slice(0, 10) || undefined,
    cost,
    price,
    status: publish ? "launched" : "discovered",
    sku: String(body.sku ?? "").trim() || undefined,
    inventory_quantity: Math.max(0, Math.floor(Number(body.inventory_quantity) || 0)),
    inventory_policy: body.inventory_policy === "continue" ? "continue" : "deny",
    images: Array.isArray(body.images) ? body.images.map(String).filter(Boolean) : [],
    image_url: Array.isArray(body.images) && body.images.length ? String(body.images[0]) : undefined,
    video_url: String(body.video_url ?? "").trim().slice(0, 1000) || undefined,
    audio_url: String(body.audio_url ?? "").trim().slice(0, 1000) || undefined,
    shopify_id: shopify?.id,
    shopify_handle: shopify?.handle,
    shopify_variant_id: shopify?.variantId,
    storefront_url: publish ? shopify?.url : undefined,
    created_at: nowISO(),
  };
  const products = await listGet<Product>(productsKey(orgId));
  products.unshift(product);
  await listReplace(productsKey(orgId), products.slice(0, 1000));
  return json({ ok: true, product, shopify_status: shopify?.status ?? null }, 201);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOwner(req, orgId);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({}));
  const productId = String(body.product_id ?? "").trim();
  if (!productId) return error("product_id is required.", 422);
  const products = await listGet<Product>(productsKey(orgId));
  const idx = products.findIndex((product) => product.id === productId);
  if (idx < 0) return error("Product not found.", 404);
  const current = products[idx];
  const patch: Partial<Product> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 180);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 5000);
  if (body.category !== undefined) {
    if (!isBotanicaStoreCategory(body.category)) return error("Choose a valid store category.", 422);
    patch.category = body.category;
  }
  if (typeof body.sku === "string") patch.sku = body.sku.trim() || undefined;
  if (typeof body.supplier === "string") patch.supplier = body.supplier.trim().slice(0, 180) || undefined;
  if (typeof body.supplier_url === "string") patch.supplier_url = body.supplier_url.trim().slice(0, 1000);
  if (typeof body.supplier_sku === "string") patch.supplier_sku = body.supplier_sku.trim().slice(0, 180) || undefined;
  if (typeof body.supplier_contact === "string") patch.supplier_contact = body.supplier_contact.trim().slice(0, 500) || undefined;
  if (typeof body.country_of_origin === "string") patch.country_of_origin = body.country_of_origin.trim().slice(0, 120) || undefined;
  if (typeof body.provenance_notes === "string") patch.provenance_notes = body.provenance_notes.trim().slice(0, 3000) || undefined;
  if (typeof body.reorder_url === "string") patch.reorder_url = body.reorder_url.trim().slice(0, 1000) || undefined;
  if (body.reorder_moq !== undefined) patch.reorder_moq = Math.max(1, Math.floor(Number(body.reorder_moq) || 1));
  if (body.reorder_case_pack !== undefined) patch.reorder_case_pack = Math.max(1, Math.floor(Number(body.reorder_case_pack) || 1));
  if (body.reorder_lead_time_days !== undefined) patch.reorder_lead_time_days = Math.max(0, Math.floor(Number(body.reorder_lead_time_days) || 0));
  if (typeof body.provenance_verified_at === "string") patch.provenance_verified_at = body.provenance_verified_at.trim().slice(0, 10) || undefined;
  if (typeof body.video_url === "string") patch.video_url = body.video_url.trim().slice(0, 1000) || undefined;
  if (typeof body.audio_url === "string") patch.audio_url = body.audio_url.trim().slice(0, 1000) || undefined;
  if (Array.isArray(body.images)) {
    const images = body.images.map(String).map((value: string) => value.trim()).filter(Boolean).slice(0, 8);
    patch.images = images;
    patch.image_url = images[0];
  }
  if (body.price !== undefined) patch.price = Math.max(0, Number(body.price) || 0);
  if (body.cost !== undefined) patch.cost = Math.max(0, Number(body.cost) || 0);
  if (body.inventory_quantity !== undefined) patch.inventory_quantity = Math.max(0, Math.floor(Number(body.inventory_quantity) || 0));
  if (body.inventory_policy === "deny" || body.inventory_policy === "continue") patch.inventory_policy = body.inventory_policy;
  if (body.status === "launched" || body.status === "discovered" || body.status === "killed") patch.status = body.status;
  const next = { ...current, ...patch };
  if (next.status === "launched" && next.price <= 0) return error("A positive price is required before publishing.", 422);
  products[idx] = next;
  await listReplace(productsKey(orgId), products);
  return json({ ok: true, product: next, shopify_sync: "not_requested" });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOwner(req, orgId);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({}));
  const productId = String(body.product_id ?? "").trim();
  const mode = String(body.mode ?? "archive");
  if (!productId) return error("product_id is required.", 422);
  if (!['archive','delete'].includes(mode)) return error("mode must be archive or delete.", 422);

  const products = await listGet<Product>(productsKey(orgId));
  const idx = products.findIndex((p) => p.id === productId);
  if (idx < 0) return error("Product not found.", 404);
  const product = products[idx];

  if (mode === "archive") {
    if (product.shopify_id) {
      try { await ownerArchiveShopifyProduct(orgId, product.shopify_id); }
      catch (e) { return error((e as Error).message, 502); }
    }
    products[idx] = { ...product, status: "killed", storefront_url: undefined };
    await listReplace(productsKey(orgId), products);
    return json({ ok: true, mode: "archive", product: products[idx] });
  }

  const confirmation = String(body.confirmation ?? "");
  if (confirmation !== `DELETE ${product.title}`) {
    return error(`Type DELETE ${product.title} to permanently delete this product.`, 409);
  }
  if (product.shopify_id) {
    try { await ownerDeleteShopifyProduct(orgId, product.shopify_id); }
    catch (e) { return error((e as Error).message, 502); }
  }
  products.splice(idx, 1);
  await listReplace(productsKey(orgId), products);
  return json({ ok: true, mode: "delete", deleted_id: productId });
}
