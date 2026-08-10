import { BOTANICA_CATEGORIES, BOTANICA_MASTER_CATALOG, ORISHA_COLLECTIONS } from "./master-catalog";
import {
  SPANISH_FIRST_COLLECTIONS,
  canCreateShopifyDraft,
  canPublishLive,
  calculateMargin,
  validateForShopifyDraft,
  type BotanicaSku,
} from "./commerce-schema";

export type MasterCatalogFamilyView = {
  id: string;
  category: string;
  name_es: string;
  name_en: string;
  tags: string[];
  commerce_mode: "PHYSICAL" | "BOOK" | "EDUCATIONAL" | "REFERENCE_ONLY";
  required_gates: string[];
  locale_priority: readonly ["es", "en"];
  publish_policy: "GATED" | "REFERENCE_ONLY";
};

export function getMasterCatalogSnapshot() {
  const families: MasterCatalogFamilyView[] = BOTANICA_MASTER_CATALOG.map((family) => ({
    ...family,
    locale_priority: ["es", "en"] as const,
    publish_policy: family.commerce_mode === "REFERENCE_ONLY" ? "REFERENCE_ONLY" : "GATED",
  }));

  return {
    brand: "BOTANICA OCHOSI",
    default_locale: "es",
    fallback_locale: "en",
    family_count: families.length,
    categories: BOTANICA_CATEGORIES,
    collections: SPANISH_FIRST_COLLECTIONS,
    orisha_collections: ORISHA_COLLECTIONS,
    families,
  };
}

export function evaluateBotanicaSku(sku: BotanicaSku) {
  const failures = validateForShopifyDraft(sku);
  const margin = calculateMargin(sku);
  return {
    sku: sku.sku,
    family_id: sku.family_id,
    name_es: sku.name_es,
    draft_ready: canCreateShopifyDraft(sku),
    live_ready: canPublishLive(sku),
    failures,
    margin,
    locale: {
      primary: "es" as const,
      fallback: "en" as const,
      spanish_complete: Boolean(sku.name_es.trim() && sku.description_es.trim()),
    },
  };
}

export function assertBotanicaSkuCanCreateDraft(sku: BotanicaSku): void {
  const failures = validateForShopifyDraft(sku);
  if (failures.length) {
    throw new Error(`BOTANICA_SKU_BLOCKED:${failures.join(",")}`);
  }
}
