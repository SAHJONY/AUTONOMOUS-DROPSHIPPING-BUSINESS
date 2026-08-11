import { describe, expect, it } from "vitest";
import { BOTANICA_FIRST_25_SKU_CANDIDATES } from "../lib/botanica-first-25-sku-candidates";
import { evaluateBotanicaCommercePipeline } from "../lib/botanica-commerce-pipeline";
import type { SupplierQuote } from "../lib/botanica-supplier-quotes";

const candidate = BOTANICA_FIRST_25_SKU_CANDIDATES.find((item) => item.sku === "BO-NG-OPON-IFE-LG")!;

function quote(overrides: Partial<SupplierQuote> = {}): SupplierQuote {
  return {
    id: "q-commerce-1",
    supplierId: "yoruba-imports",
    supplierName: "Yoruba Imports",
    productName: candidate.title,
    sku: candidate.sku,
    countryOfOrigin: "Nigeria",
    tradition: "YORUBA_IFA_ISESE",
    currency: "USD",
    unitCost: 50,
    quantity: 10,
    moq: 10,
    freightTotal: 50,
    dutyTotal: 20,
    retailPriceUsd: 150,
    evidence: [
      {
        sourceUrl: "https://example.com/wholesale-quote",
        observedAt: "2026-08-09T00:00:00.000Z",
        evidenceType: "WRITTEN_QUOTE",
      },
    ],
    exportVerified: true,
    culturalUseVerified: true,
    ownerApproved: false,
    ...overrides,
  };
}

const scores = {
  provenanceScore: 90,
  supplierReliabilityScore: 85,
  demandScore: 75,
  catalogGapScore: 90,
};

describe("BOTANICA commerce pipeline", () => {
  it("reaches Council approval but still blocks Shopify draft without owner catalog approval", () => {
    const result = evaluateBotanicaCommercePipeline(
      { candidate, quote: quote(), ...scores },
      { now: new Date("2026-08-09T12:00:00.000Z") },
    );

    expect(result.stage).toBe("COUNCIL_APPROVED");
    expect(result.canCreateShopifyDraft).toBe(false);
    expect(result.canPublishShopify).toBe(false);
    expect(result.canCommitPurchase).toBe(false);
  });

  it("allows only Shopify draft after owner catalog approval", () => {
    const result = evaluateBotanicaCommercePipeline(
      { candidate, quote: quote(), ...scores, ownerCatalogApproved: true },
      { now: new Date("2026-08-09T12:00:00.000Z") },
    );

    expect(result.stage).toBe("OWNER_APPROVED_FOR_DRAFT");
    expect(result.canCreateShopifyDraft).toBe(true);
    expect(result.canPublishShopify).toBe(false);
    expect(result.canCommitPurchase).toBe(false);
  });

  it("does not let owner approval override failed provenance", () => {
    const result = evaluateBotanicaCommercePipeline(
      {
        candidate,
        quote: quote(),
        ...scores,
        provenanceScore: 20,
        ownerCatalogApproved: true,
      },
      { now: new Date("2026-08-09T12:00:00.000Z") },
    );

    expect(result.stage).toBe("HOLD");
    expect(result.canCreateShopifyDraft).toBe(false);
    expect(result.reasons).toContain("provenance evidence score is below 60");
  });

  it("does not let owner catalog approval authorize a purchase", () => {
    const result = evaluateBotanicaCommercePipeline(
      {
        candidate,
        quote: quote({ ownerApproved: true }),
        ...scores,
        ownerCatalogApproved: true,
      },
      { now: new Date("2026-08-09T12:00:00.000Z") },
    );

    expect(result.canCreateShopifyDraft).toBe(true);
    expect(result.canCommitPurchase).toBe(false);
    expect(result.canPublishShopify).toBe(false);
  });
});
