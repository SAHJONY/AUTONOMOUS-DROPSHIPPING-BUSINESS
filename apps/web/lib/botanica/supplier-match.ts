import { BOTANICA_MASTER_CATALOG, type BotanicaProductFamily } from "./master-catalog";
import type { BotanicaSupplier, BotanicaSku } from "./commerce-schema";
import { evaluateBotanicaSku } from "./catalog-service";

export type SupplierCandidateProfile = BotanicaSupplier & {
  priority: number;
  regions: string[];
  category_keywords: string[];
  verification_status: "PENDING" | "VERIFIED" | "REJECTED";
};

export const SUPPLIER_CANDIDATES: SupplierCandidateProfile[] = [
  {
    id: "monzon-botanica",
    name: "Monzon Botanica",
    website: "",
    country: "US",
    wholesale_available: false,
    reseller_terms_verified: false,
    contact_verified: false,
    inventory_feed: "NONE",
    fulfillment: "UNKNOWN",
    priority: 1,
    regions: ["Miami", "Hialeah", "Florida", "USA"],
    category_keywords: ["Orishas", "Collares", "Herramientas", "Soperas", "Velas", "Hierbas", "Baños", "Aceites", "Colonias", "Jabones", "Inciensos", "Cascarilla", "Textiles", "Estatuas", "Instrumentos"],
    verification_status: "PENDING",
    notes: "Priority local candidate. Commercial terms, source URL, landed cost, inventory and provenance still require evidence.",
  },
  {
    id: "indiana-university-press",
    name: "Indiana University Press",
    website: "https://iupress.org",
    country: "US",
    wholesale_available: false,
    reseller_terms_verified: false,
    contact_verified: false,
    inventory_feed: "MANUAL",
    fulfillment: "UNKNOWN",
    priority: 2,
    regions: ["USA"],
    category_keywords: ["Libros", "Educación", "Ifá", "Diloggún", "Yoruba"],
    verification_status: "PENDING",
    notes: "Publisher candidate. ISBN/title evidence does not equal verified reseller terms.",
  },
  {
    id: "llewellyn-worldwide",
    name: "Llewellyn Worldwide",
    website: "https://www.llewellyn.com/booksellers/",
    country: "US",
    wholesale_available: false,
    reseller_terms_verified: false,
    contact_verified: false,
    inventory_feed: "MANUAL",
    fulfillment: "UNKNOWN",
    priority: 3,
    regions: ["USA"],
    category_keywords: ["Libros", "Educación", "Ifá", "Orishas", "Yoruba"],
    verification_status: "PENDING",
    notes: "Bookseller-program candidate. Account approval and current commercial terms must be verified.",
  },
  {
    id: "red-wheel-weiser",
    name: "Red Wheel / Weiser",
    website: "https://redwheelweiser.com",
    country: "US",
    wholesale_available: false,
    reseller_terms_verified: false,
    contact_verified: false,
    inventory_feed: "MANUAL",
    fulfillment: "UNKNOWN",
    priority: 4,
    regions: ["USA"],
    category_keywords: ["Libros", "Educación", "Orishas", "Yoruba"],
    verification_status: "PENDING",
    notes: "Publisher candidate; public list price must never be treated as wholesale cost.",
  },
  {
    id: "inner-traditions",
    name: "Inner Traditions / Destiny Books",
    website: "https://www.innertraditions.com",
    country: "US",
    wholesale_available: false,
    reseller_terms_verified: false,
    contact_verified: false,
    inventory_feed: "MANUAL",
    fulfillment: "UNKNOWN",
    priority: 5,
    regions: ["USA"],
    category_keywords: ["Libros", "Educación", "Santería", "Lucumí", "Patakines", "Diloggún"],
    verification_status: "PENDING",
    notes: "Publisher candidate. Authorized edition and reseller evidence required per SKU.",
  },
];

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function scoreSupplierForFamily(supplier: SupplierCandidateProfile, family: BotanicaProductFamily): number {
  const haystack = normalized(`${family.category} ${family.name_es} ${family.name_en} ${family.tags.join(" ")}`);
  const keywordMatches = supplier.category_keywords.filter((keyword) => haystack.includes(normalized(keyword))).length;
  const usaBoost = supplier.regions.includes("USA") ? 2 : 0;
  const localBoost = supplier.regions.some((region) => ["Miami", "Hialeah", "Houston"].includes(region)) ? 3 : 0;
  return keywordMatches * 10 + usaBoost + localBoost - supplier.priority;
}

export function getSupplierMatches(limitPerFamily = 3) {
  return BOTANICA_MASTER_CATALOG.map((family) => ({
    family,
    suppliers: SUPPLIER_CANDIDATES
      .map((supplier) => ({ supplier, score: scoreSupplierForFamily(supplier, family) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limitPerFamily),
  }));
}

export function createCandidateSku(family: BotanicaProductFamily, supplier: SupplierCandidateProfile): BotanicaSku {
  const sku: BotanicaSku = {
    id: `candidate:${family.id}:${supplier.id}`,
    family_id: family.id,
    sku: `CANDIDATE-${family.id.toUpperCase()}`,
    name_es: family.name_es,
    name_en: family.name_en,
    description_es: `Candidato de abastecimiento para ${family.name_es}. Requiere verificación comercial y cultural antes de Shopify.`,
    description_en: `Sourcing candidate for ${family.name_en}. Commercial and cultural verification is required before Shopify.`,
    category: family.category,
    collections: [],
    supplier_id: supplier.id,
    supplier_url: supplier.website || undefined,
    supplier_status: supplier.verification_status === "VERIFIED" ? "VERIFIED" : "PENDING",
    rights_status: family.commerce_mode === "BOOK" ? "RIGHTS_PENDING" : "VERIFIED_REFERENCE_ONLY",
    cultural_status: "PENDING",
    commerce_safety_status: "PENDING",
    currency: "USD",
    inventory_status: "UNKNOWN",
    image_rights_verified: false,
    source_evidence: [],
    gates_passed: [],
    publish_status: "HOLD",
  };
  return sku;
}

export function getCandidateSkuPipeline(limitPerFamily = 3) {
  return getSupplierMatches(limitPerFamily).flatMap(({ family, suppliers }) =>
    suppliers.map(({ supplier, score }) => {
      const sku = createCandidateSku(family, supplier);
      return { family, supplier, score, sku, evaluation: evaluateBotanicaSku(sku) };
    }),
  );
}
