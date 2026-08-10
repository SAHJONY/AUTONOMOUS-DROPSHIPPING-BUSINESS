import { error, json, requireOrgRole } from "@/lib/api";
import { listGet, listReplace } from "@/lib/kv";
import { newId, nowISO } from "@/lib/store";
import type { Product } from "@/lib/types";
import {
  ownerArchiveShopifyProduct,
  ownerCreateShopifyProduct,
  ownerDeleteShopifyProduct,
} from "@/lib/owner-catalog-shopify";
import { listVerificationRecords, markVerificationShopifyDraft } from "@/lib/botanica/verification-workbench";

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
  return json(await listGet<Product>(productsKey(orgId)));
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOwner(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const requestedTitle = String(body.title ?? "").trim();
  if (!requestedTitle) return error("Product title is required.", 422);
  const syncShopify = body.sync_shopify !== false;
  const requestVerifiedDraft = body.publish === true;
  const verificationCandidateId = String(body.verification_candidate_id ?? "").trim();

  let title = requestedTitle;
  let description = String(body.description ?? "");
  let supplierUrl = String(body.supplier_url ?? "");
  let supplier = String(body.supplier ?? "");
  let skuValue = String(body.sku ?? "").trim() || undefined;
  let price = Math.max(0, Number(body.price ?? 0));
  let cost = Math.max(0, Number(body.cost ?? 0));
  let productType = String(body.product_type ?? "Botanica");
  let images = Array.isArray(body.images) ? body.images.map(String).filter(Boolean) : [];

  if (requestVerifiedDraft) {
    if (!verificationCandidateId) {
      return error("A verified BOTANICA candidate is required before creating a Shopify draft.", 409);
    }
    const records = await listVerificationRecords(orgId);
    const record = records.find((item) => item.candidate_id === verificationCandidateId);
    if (!record) return error("BOTANICA verification record not found.", 404);
    if (!record.evaluation.draft_ready || record.sku.publish_status !== "READY_FOR_REVIEW") {
      return error(`BOTANICA SKU is not ready for review: ${record.evaluation.failures.join(", ") || "verification incomplete"}.`, 409);
    }

    // The verification record is the source of truth for any Shopify-bound draft.
    title = record.sku.name_es;
    description = record.sku.description_es;
    supplierUrl = record.sku.supplier_url ?? "";
    supplier = record.sku.supplier_id ?? supplier;
    skuValue = record.sku.sku;
    price = Number(record.sku.retail_price ?? 0);
    cost = Number(record.sku.landed_cost ?? record.sku.unit_cost ?? 0);
    productType = record.sku.category || "Botanica";
    images = [];
    if (price <= 0) return error("Verified retail price is required before Shopify draft creation.", 409);
  }

  let shopify: Awaited<ReturnType<typeof ownerCreateShopifyProduct>> | undefined;
  if (syncShopify) {
    try {
      shopify = await ownerCreateShopifyProduct(orgId, {
        title,
        description,
        price,
        sku: skuValue,
        productType,
        imageUrls: images,
        // All owner-catalog creations are draft-first. Live publication is a separate governed action.
        publish: false,
      });
    } catch (e) {
      return error((e as Error).message, 502);
    }
  }

  if (requestVerifiedDraft && syncShopify) {
    try {
      await markVerificationShopifyDraft(orgId, verificationCandidateId, {
        product_id: shopify?.id,
        variant_id: shopify?.variantId,
      });
    } catch (e) {
      if (shopify?.id) {
        try { await ownerArchiveShopifyProduct(orgId, shopify.id); } catch { /* best-effort rollback */ }
      }
      return error((e as Error).message, 409);
    }
  }

  const product: Product = {
    id: newId(),
    org_id: orgId,
    title,
    description,
    source: requestVerifiedDraft ? "botanica_verified" : "owner_manual",
    supplier_url: supplierUrl,
    supplier,
    cost,
    price,
    status: "discovered",
    sku: skuValue,
    images,
    image_url: images.length ? images[0] : undefined,
    shopify_id: shopify?.id,
    shopify_handle: shopify?.handle,
    shopify_variant_id: shopify?.variantId,
    storefront_url: undefined,
    created_at: nowISO(),
  };
  const products = await listGet<Product>(productsKey(orgId));
  products.unshift(product);
  await listReplace(productsKey(orgId), products.slice(0, 1000));
  return json({
    ok: true,
    product,
    shopify_status: shopify?.status ?? null,
    release_state: requestVerifiedDraft ? "SHOPIFY_DRAFT" : "INTERNAL_OR_DRAFT_ONLY",
    live_published: false,
  }, 201);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOwner(req, orgId);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({}));
  const productId = String(body.product_id ?? "").trim();
  const mode = String(body.mode ?? "archive");
  if (!productId) return error("product_id is required.", 422);
  if (!["archive","delete"].includes(mode)) return error("mode must be archive or delete.", 422);

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
