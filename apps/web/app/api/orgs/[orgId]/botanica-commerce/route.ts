import { error, json, requireOrgRole } from "@/lib/api";
import { BOTANICA_FIRST_25_SKU_CANDIDATES } from "@/lib/botanica-first-25-sku-candidates";
import { evaluateBotanicaCommercePipeline } from "@/lib/botanica-commerce-pipeline";
import type { SupplierQuote } from "@/lib/botanica-supplier-quotes";
import { listGet, listReplace } from "@/lib/kv";
import { ownerCreateShopifyProduct } from "@/lib/owner-catalog-shopify";
import { newId, nowISO } from "@/lib/store";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const productsKey = (orgId: string) => `products:${orgId}`;

async function requireOwner(req: Request, orgId: string) {
  return requireOrgRole(req, orgId, ["owner"]);
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOwner(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "evaluate");
  if (!['evaluate','create_draft'].includes(action)) {
    return error("action must be evaluate or create_draft.", 422);
  }

  const sku = String(body.sku ?? "").trim();
  const candidate = BOTANICA_FIRST_25_SKU_CANDIDATES.find((item) => item.sku === sku);
  if (!candidate) return error("BOTANICA SKU candidate not found.", 404);

  const quote = body.quote as SupplierQuote | undefined;
  if (!quote || typeof quote !== "object") return error("A supplier quote is required.", 422);
  if (String(quote.sku ?? sku) !== sku) return error("Quote SKU must match candidate SKU.", 422);

  const result = evaluateBotanicaCommercePipeline({
    candidate,
    quote: { ...quote, sku },
    demandScore: Number.isFinite(Number(body.demand_score)) ? Number(body.demand_score) : undefined,
    catalogGapScore: Number.isFinite(Number(body.catalog_gap_score)) ? Number(body.catalog_gap_score) : undefined,
    supplierReliabilityScore: Number.isFinite(Number(body.supplier_reliability_score))
      ? Number(body.supplier_reliability_score)
      : undefined,
    provenanceScore: Number.isFinite(Number(body.provenance_score)) ? Number(body.provenance_score) : undefined,
    ownerCatalogApproved: body.owner_catalog_approved === true,
  });

  if (action === "evaluate") return json({ ok: true, result });

  if (!result.canCreateShopifyDraft) {
    return error(`Shopify draft blocked: ${result.reasons.join("; ") || "commerce gates are not satisfied"}`, 409);
  }

  const retailPrice = Number(quote.retailPriceUsd ?? 0);
  const landedCost = Number(result.opportunity.quoteEvaluation.landedCostPerUnitUsd ?? 0);
  if (retailPrice <= 0 || landedCost <= 0) {
    return error("Verified positive retail price and landed cost are required before creating a draft.", 409);
  }

  const description = String(body.description ?? "").trim();
  const images = Array.isArray(body.images) ? body.images.map(String).filter(Boolean) : [];

  let shopify: Awaited<ReturnType<typeof ownerCreateShopifyProduct>>;
  try {
    shopify = await ownerCreateShopifyProduct(orgId, {
      title: candidate.title,
      description,
      price: retailPrice,
      sku,
      productType: candidate.lane,
      imageUrls: images,
      publish: false,
    });
  } catch (e) {
    return error((e as Error).message, 502);
  }

  const product: Product = {
    id: newId(),
    org_id: orgId,
    title: candidate.title,
    description,
    source: "botanica_supplier_intelligence",
    supplier_url: quote.evidence[0]?.sourceUrl ?? candidate.sourceUrl,
    supplier: quote.supplierName,
    cost: landedCost,
    price: retailPrice,
    status: "analyzed",
    score: result.opportunity.score,
    verdict: result.council.verdict,
    sku,
    images,
    image_url: images[0],
    shopify_id: shopify.id,
    shopify_handle: shopify.handle,
    shopify_variant_id: shopify.variantId,
    created_at: nowISO(),
  };

  const products = await listGet<Product>(productsKey(orgId));
  const existing = products.findIndex((item) => item.sku === sku && item.status !== "killed");
  if (existing >= 0) {
    return error("An active internal catalog product already exists for this SKU.", 409);
  }
  products.unshift(product);
  await listReplace(productsKey(orgId), products.slice(0, 1000));

  return json({
    ok: true,
    action: "create_draft",
    product,
    shopify_status: shopify.status,
    pipeline: result,
    purchase_authorized: false,
    publish_authorized: false,
  }, 201);
}
