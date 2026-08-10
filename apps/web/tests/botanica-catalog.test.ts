import { describe, expect, it } from "vitest";
import { evaluateBotanicaSku, getMasterCatalogSnapshot } from "../lib/botanica/catalog-service";
import type { BotanicaSku } from "../lib/botanica/commerce-schema";

function validSku(overrides: Partial<BotanicaSku> = {}): BotanicaSku {
  return {
    id: "sku-test-1",
    family_id: "candle-plain",
    sku: "BOT-CANDLE-WHITE-7D",
    name_es: "Velón blanco de 7 días",
    name_en: "White 7-Day Candle",
    description_es: "Velón blanco para uso cultural y devocional.",
    description_en: "White candle for cultural and devotional use.",
    category: "Velas y Velones",
    collections: ["Velas y Velones"],
    tradition: ["LUCUMI", "CULTURAL"],
    supplier_id: "supplier-verified",
    supplier_sku: "WHITE-7D",
    supplier_url: "https://supplier.example/products/white-7d",
    supplier_status: "VERIFIED",
    rights_status: "VERIFIED_AUTHORIZED",
    cultural_status: "VERIFIED",
    commerce_safety_status: "VERIFIED",
    unit_cost: 3,
    shipping_cost: 1,
    landed_cost: 4,
    retail_price: 10,
    currency: "USD",
    inventory_status: "IN_STOCK",
    inventory_qty: 20,
    image_rights_verified: true,
    source_evidence: ["supplier invoice", "authorized product image"],
    gates_passed: ["CULTURAL_VERIFIED", "SUPPLIER_VERIFIED", "RIGHTS_VERIFIED", "COMMERCE_SAFE"],
    publish_status: "READY_FOR_REVIEW",
    ...overrides,
  };
}

const blockedCases: Array<[string, Partial<BotanicaSku>, string]> = [
  ["supplier", { supplier_status: "PENDING" }, "SUPPLIER_VERIFIED"],
  ["rights", { rights_status: "RIGHTS_PENDING" }, "RIGHTS_VERIFIED"],
  ["culture", { cultural_status: "PENDING" }, "CULTURAL_VERIFIED"],
  ["safety", { commerce_safety_status: "PENDING" }, "COMMERCE_SAFE"],
  ["image rights", { image_rights_verified: false }, "IMAGE_RIGHTS_VERIFIED"],
  ["source evidence", { source_evidence: [] }, "SOURCE_EVIDENCE"],
  ["Spanish content", { description_es: "" }, "SPANISH_CONTENT"],
  ["inventory", { inventory_status: "UNKNOWN" }, "INVENTORY_AVAILABLE"],
];

describe("BOTANICA Spanish-first master catalog", () => {
  it("uses Spanish as the commercial default and English as fallback", () => {
    const snapshot = getMasterCatalogSnapshot();
    expect(snapshot.default_locale).toBe("es");
    expect(snapshot.fallback_locale).toBe("en");
    expect(snapshot.family_count).toBeGreaterThan(50);
    expect(snapshot.collections).toContain("Dice Ifá");
    expect(snapshot.collections).toContain("256 Odù");
  });

  it("exposes the expanded botanica registry without granting Shopify draft readiness", () => {
    const snapshot = getMasterCatalogSnapshot();
    expect(snapshot.candidate_registry_count).toBeGreaterThan(50);
    expect(snapshot.candidate_category_counts["Ifá"]).toBeGreaterThan(0);
    expect(snapshot.candidate_category_counts["Dice Ifá"]).toBeGreaterThan(0);
    expect(snapshot.candidate_registry.every((candidate) => candidate.shopify_draft_ready === false)).toBe(true);
    expect(snapshot.candidate_registry.every((candidate) => candidate.publish_policy === "HOLD" || candidate.publish_policy === "REFERENCE_ONLY")).toBe(true);
  });

  it("keeps high-risk candidate classes behind explicit review gates", () => {
    const snapshot = getMasterCatalogSnapshot();
    const ikin = snapshot.candidate_registry.find((candidate) => candidate.slug === "ikin-ifa");
    const diceIfa = snapshot.candidate_registry.find((candidate) => candidate.slug === "idafa-dice-ifa");
    const driedEwe = snapshot.candidate_registry.find((candidate) => candidate.slug === "ewe-dried-herb-single");
    expect(ikin?.gates).toEqual(expect.arrayContaining(["PROVENANCE", "PRACTITIONER_REVIEW", "IMPORT_REVIEW"]));
    expect(diceIfa?.publish_policy).toBe("REFERENCE_ONLY");
    expect(diceIfa?.gates).toEqual(expect.arrayContaining(["RIGHTS_REVIEW", "PRACTITIONER_REVIEW"]));
    expect(driedEwe?.gates).toEqual(expect.arrayContaining(["AGRICULTURE_REVIEW", "IMPORT_REVIEW", "PROVENANCE"]));
  });

  it("allows a fully verified SKU to reach Shopify draft readiness", () => {
    const result = evaluateBotanicaSku(validSku());
    expect(result.draft_ready).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.margin?.margin_pct).toBe(60);
  });

  it.each(blockedCases)("blocks Shopify draft when %s verification is missing", (_label, overrides, gate) => {
    const result = evaluateBotanicaSku(validSku(overrides));
    expect(result.draft_ready).toBe(false);
    expect(result.failures).toContain(gate);
  });

  it("requires owner-controlled Shopify draft state before live readiness", () => {
    expect(evaluateBotanicaSku(validSku()).live_ready).toBe(false);
    expect(evaluateBotanicaSku(validSku({ publish_status: "SHOPIFY_DRAFT" })).live_ready).toBe(true);
  });
});
