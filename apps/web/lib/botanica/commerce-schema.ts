import type { BotanicaGate } from "./master-catalog";

export type RightsStatus = "VERIFIED_AUTHORIZED" | "VERIFIED_REFERENCE_ONLY" | "RIGHTS_PENDING" | "REJECTED";
export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type InventoryStatus = "UNKNOWN" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "DISCONTINUED";
export type PublishStatus = "HOLD" | "READY_FOR_REVIEW" | "SHOPIFY_DRAFT" | "PUBLISHED" | "ARCHIVED";

export type BotanicaSku = {
  id: string;
  family_id: string;
  sku: string;
  name_es: string;
  name_en: string;
  name_yo?: string;
  description_es: string;
  description_en?: string;
  category: string;
  collections: string[];
  orishas?: string[];
  tradition?: Array<"LUCUMI" | "IFA" | "YORUBA" | "CULTURAL">;
  materials?: string[];
  size?: string;
  color?: string;
  country_of_origin?: string;
  isbn?: string;
  author?: string;
  publisher?: string;
  language?: string;
  supplier_id?: string;
  supplier_sku?: string;
  supplier_url?: string;
  supplier_status: VerificationStatus;
  rights_status: RightsStatus;
  cultural_status: VerificationStatus;
  commerce_safety_status: VerificationStatus;
  unit_cost?: number;
  shipping_cost?: number;
  landed_cost?: number;
  retail_price?: number;
  currency: "USD";
  inventory_status: InventoryStatus;
  inventory_qty?: number;
  inventory_verified_at?: string;
  price_verified_at?: string;
  source_verified_at?: string;
  image_rights_verified: boolean;
  source_evidence: string[];
  gates_passed: BotanicaGate[];
  publish_status: PublishStatus;
  shopify_product_id?: string;
  shopify_variant_id?: string;
};

export type BotanicaSupplier = {
  id: string;
  name: string;
  website: string;
  country: string;
  wholesale_available: boolean;
  reseller_terms_verified: boolean;
  contact_verified: boolean;
  inventory_feed: "API" | "CSV" | "MANUAL" | "NONE";
  fulfillment: "DROPSHIP" | "WHOLESALE" | "BOTH" | "UNKNOWN";
  verified_at?: string;
  notes?: string;
};

export const SPANISH_FIRST_COLLECTIONS = [
  "Ifá en Español",
  "Dice Ifá",
  "256 Odù",
  "Santería y Lucumí",
  "Patakines e Itan",
  "Odù y Diloggún",
  "Orishas",
  "Cultura Yoruba",
  "Diccionarios Yoruba–Español",
  "Material Educativo",
  "Collares e Ilekes",
  "Herramientas de Orisha",
  "Soperas y Altares",
  "Velas y Velones",
  "Hierbas y Ewé",
  "Baños y Despojos",
  "Aceites y Esencias",
  "Colonias y Perfumes",
  "Jabones",
  "Inciensos y Sahumerios",
  "Cascarilla y Polvos",
  "Resguardos y Accesorios",
  "Textiles y Vestimenta",
  "Estatuas e Imágenes",
  "Instrumentos y Música",
] as const;

export function calculateMargin(sku: BotanicaSku): { gross_profit: number; margin_pct: number } | null {
  if (sku.retail_price == null || sku.landed_cost == null || sku.retail_price <= 0) return null;
  const gross_profit = sku.retail_price - sku.landed_cost;
  return { gross_profit, margin_pct: (gross_profit / sku.retail_price) * 100 };
}

export function validateForShopifyDraft(sku: BotanicaSku): string[] {
  const failures: string[] = [];
  if (sku.supplier_status !== "VERIFIED") failures.push("SUPPLIER_VERIFIED");
  if (sku.cultural_status !== "VERIFIED") failures.push("CULTURAL_VERIFIED");
  if (sku.commerce_safety_status !== "VERIFIED") failures.push("COMMERCE_SAFE");
  if (sku.rights_status !== "VERIFIED_AUTHORIZED") failures.push("RIGHTS_VERIFIED");
  if (!sku.image_rights_verified) failures.push("IMAGE_RIGHTS_VERIFIED");
  if (!sku.source_evidence.length) failures.push("SOURCE_EVIDENCE");
  if (sku.unit_cost == null || sku.retail_price == null) failures.push("VERIFIED_PRICE");
  if (!sku.supplier_url) failures.push("SUPPLIER_SOURCE");
  if (!sku.name_es.trim() || !sku.description_es.trim()) failures.push("SPANISH_CONTENT");
  if (sku.inventory_status !== "IN_STOCK" && sku.inventory_status !== "LOW_STOCK") failures.push("INVENTORY_AVAILABLE");
  return failures;
}

export function canCreateShopifyDraft(sku: BotanicaSku): boolean {
  return validateForShopifyDraft(sku).length === 0;
}

export function canPublishLive(sku: BotanicaSku): boolean {
  return canCreateShopifyDraft(sku) && sku.publish_status === "SHOPIFY_DRAFT";
}
