import { error, requireOrgRole } from "@/lib/api";
import { listGet, listReplace } from "@/lib/kv";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const key = (orgId: string) => `owner:supplier-catalogs:${orgId}`;
const MAX_RECORDS = 5_000;
const MAX_BODY_BYTES = 2_000_000;
const privateJson = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });

type SecretSupplierProduct = Record<string, unknown> & { id: string; supplier: string; name: string };

function text(value: unknown, max = 2_000) { return String(value ?? "").trim().slice(0, max); }
function number(value: unknown, min = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(min, parsed) : min; }

function sanitize(record: Record<string, unknown>): SecretSupplierProduct | null {
  const supplier = text(record.supplier, 300);
  const name = text(record.name, 500);
  if (!supplier || !name) return null;
  return {
    id: text(record.id, 100) || crypto.randomUUID(), supplier, name,
    sku: text(record.sku, 200), category: text(record.category, 300), currency: text(record.currency, 10).toUpperCase() || "USD",
    wholesalePrice: number(record.wholesalePrice), shippingCost: number(record.shippingCost), handlingCost: number(record.handlingCost), markupPercent: number(record.markupPercent), usdExchangeRate: number(record.usdExchangeRate),
    moq: Math.ceil(number(record.moq, 1)), unit: text(record.unit, 100), productUrl: text(record.productUrl, 2_000),
    supplierProcessingDays: Math.ceil(number(record.supplierProcessingDays)), importTransitDays: Math.ceil(number(record.importTransitDays)), handlingDays: Math.ceil(number(record.handlingDays)), customerShippingDays: Math.ceil(number(record.customerShippingDays)),
    botanicaWholesaleEnabled: record.botanicaWholesaleEnabled === true, botanicaWholesalePrice: number(record.botanicaWholesalePrice), botanicaWholesaleMoq: Math.ceil(number(record.botanicaWholesaleMoq, 1)),
    notes: text(record.notes, 10_000), updatedAt: text(record.updatedAt, 100) || new Date().toISOString(),
    competitorUrl: text(record.competitorUrl, 2_000), competitorPriceUsd: number(record.competitorPriceUsd),
    competitorCurrency: text(record.competitorCurrency, 10).toUpperCase(), competitorScannedAt: text(record.competitorScannedAt, 100),
    competitorScanStatus: text(record.competitorScanStatus, 1_000), competitivePriceRecommendationUsd: number(record.competitivePriceRecommendationUsd),
    brandMode: text(record.brandMode, 50), resaleAuthorizationStatus: text(record.resaleAuthorizationStatus, 30),
    authorizationReference: text(record.authorizationReference, 1_000), authorizationVerifiedAt: text(record.authorizationVerifiedAt, 100),
    materialType: text(record.materialType, 30) || "PRODUCT", spanishEditionClass: text(record.spanishEditionClass, 50), isbn: text(record.isbn, 40),
    publisher: text(record.publisher, 300), publicationCountry: text(record.publicationCountry, 100), authorizedReseller: text(record.authorizedReseller, 300),
    commercialEditionStatus: text(record.commercialEditionStatus, 30) || "PENDING", rightsReference: text(record.rightsReference, 1_000),
    bookCollection: text(record.bookCollection, 50), primaryLanguage: text(record.primaryLanguage, 10) || "es",
    yorubaValidated: record.yorubaValidated === true, englishSecondaryDescription: text(record.englishSecondaryDescription, 5_000),
    originalSpanishDescription: text(record.originalSpanishDescription, 5_000), inventoryStatus: text(record.inventoryStatus, 30) || "UNKNOWN",
    inventoryQuantity: Math.floor(number(record.inventoryQuantity)), inventoryVerifiedAt: text(record.inventoryVerifiedAt, 100),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params; const auth = await requireOrgRole(req, orgId, ["owner"]); if ("response" in auth) return auth.response;
  return privateJson(await listGet<SecretSupplierProduct>(key(orgId)));
}

export async function PUT(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params; const auth = await requireOrgRole(req, orgId, ["owner"]); if ("response" in auth) return auth.response;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return error("Supplier catalog payload is too large.", 413);
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body)) return error("A product array is required.", 422);
  if (body.length > MAX_RECORDS) return error(`A maximum of ${MAX_RECORDS} products is allowed.`, 422);
  const unique = new Map<string, SecretSupplierProduct>();
  for (const raw of body) { if (!raw || typeof raw !== "object") continue; const product = sanitize(raw as Record<string, unknown>); if (!product) continue; const identity = `${product.supplier.toLowerCase()}|${String(product.sku || product.name).toLowerCase()}`; if (!unique.has(identity)) unique.set(identity, product); }
  const products = [...unique.values()]; await listReplace(key(orgId), products);
  return privateJson({ ok: true, count: products.length });
}
