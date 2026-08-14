import { BOTANICA_FIRST_25_SKU_CANDIDATES, type BotanicaSkuCandidate } from "./botanica-first-25-sku-candidates";
import type { BotanicaStoreCategory } from "./botanica-store-categories";
import type { Product } from "./types";

const CATEGORY_BY_SKU: Record<string, BotanicaStoreCategory> = {
  "BO-NG-EDUN-ARA": "IFÁ", "BO-NG-ESU-AJE": "ELEGUÁ / ESHU", "BO-NG-IYEROSUN": "POLVOS",
  "BO-NG-OROGBO": "INGREDIENTES", "BO-NG-OBI-ABATA": "INGREDIENTES", "BO-NG-EWE-HERBS": "HIERBAS",
  "BO-LC-COLLAR-YEMAYA": "COLLARES", "BO-LC-ILDE-OYA": "ILDE / BRACELETS", "BO-LC-COLLARES-ORISHA": "COLLARES",
  "BO-LC-HERRAMIENTAS-ORISHA": "HERRAMIENTAS ORICHAS", "BO-LC-ABANICOS-YORUBA": "ABANICOS",
  "BO-LC-SOPERA-OSHUN": "SOPERAS", "BO-LC-SOPERA-YEMAYA": "SOPERAS", "BO-LC-CORONAS": "CORONAS DE SANTOS",
  "BO-LC-MARACAS": "HERRAMIENTAS ORICHAS", "BO-BC-VELAS-7D": "VELAS / CANDLES", "BO-BC-ACEITES": "ACEITES",
  "BO-BC-BANOS": "BAÑOS / RIEGOS", "BO-BC-JABONES": "JABONES / SOAPS", "BO-BC-INCIENSOS": "INCIENSOS",
  "BO-BC-COLONIAS": "COLONIA / COLOGNE", "BO-BC-ESENCIAS": "PERFUMES AROMÁTICOS 1 OZ",
};

function category(candidate: BotanicaSkuCandidate): BotanicaStoreCategory {
  return CATEGORY_BY_SKU[candidate.sku] ?? (candidate.sku.includes("OPON") ? "IFÁ" : "MISCELLANEOUS");
}

export function first25Draft(candidate: BotanicaSkuCandidate, orgId: string, createdAt: string): Product {
  return {
    id: `first25_${candidate.sku.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    org_id: orgId,
    title: candidate.title,
    description: `${candidate.title}. Candidato comercial respaldado por una fuente pública; conservar en HOLD hasta verificar costo, inventario, imágenes autorizadas, envío y procedencia.`,
    category: category(candidate),
    source: "botanica_first_25",
    supplier: candidate.supplier,
    supplier_url: candidate.sourceUrl,
    reorder_url: candidate.sourceUrl,
    supplier_sku: candidate.sku,
    sku: candidate.sku,
    provenance_notes: `${candidate.evidenceStatus}. ${candidate.notes}`,
    cost: 0,
    price: 0,
    inventory_quantity: 0,
    inventory_policy: "deny",
    status: "discovered",
    images: [],
    created_at: createdAt,
  };
}

export function seedFirst25NativeDrafts(orgId: string, existing: Product[], createdAt = new Date().toISOString()) {
  const identities = new Set(existing.flatMap((product) => [product.sku, product.supplier_sku].filter(Boolean)));
  const created = BOTANICA_FIRST_25_SKU_CANDIDATES
    .filter((candidate) => !identities.has(candidate.sku))
    .map((candidate) => first25Draft(candidate, orgId, createdAt));
  return { products: [...created, ...existing], created, existing: 25 - created.length };
}

type ReadinessProduct = {
  status: string; cost: number; price: number; title?: string; sku?: string; category?: string; description?: string;
  supplier?: string; supplier_sku?: string; reorder_url?: string; supplier_url?: string; provenance_verified_at?: string;
  inventory_quantity?: number; image_url?: string; images?: string[]; shipping_weight_oz?: number;
  package_length_in?: number; package_width_in?: number; package_height_in?: number;
};

export function productionCatalogReadiness(products: ReadinessProduct[]) {
  const live = products.filter((product) => product.status === "launched");
  const ready = live.filter((product) =>
    Boolean(product.title && product.sku && product.category && product.description && product.supplier && product.supplier_sku &&
      (product.reorder_url || product.supplier_url) && product.provenance_verified_at && product.cost > 0 && product.price > product.cost &&
      (product.inventory_quantity ?? 0) > 0 && (product.image_url || product.images?.length) && (product.shipping_weight_oz ?? 0) > 0 &&
      (product.package_length_in ?? 0) > 0 && (product.package_width_in ?? 0) > 0 && (product.package_height_in ?? 0) > 0),
  );
  return { target: 25, live: live.length, ready: ready.length, productionReady: ready.length >= 25 };
}
