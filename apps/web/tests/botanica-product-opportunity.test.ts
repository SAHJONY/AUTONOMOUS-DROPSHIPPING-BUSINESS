import { describe, expect, it } from "vitest";
import { evaluateProductOpportunity, rankProductOpportunities } from "../lib/botanica-product-opportunity";
import type { SupplierQuote } from "../lib/botanica-supplier-quotes";

function baseQuote(overrides: Partial<SupplierQuote> = {}): SupplierQuote {
  return {
    id: "q1",
    supplierId: "supplier-1",
    supplierName: "Supplier 1",
    productName: "Iroke Ifa",
    countryOfOrigin: "Nigeria",
    tradition: "YORUBA_IFA_ISESE",
    currency: "USD",
    unitCost: 20,
    quantity: 10,
    freightTotal: 20,
    dutyTotal: 10,
    retailPriceUsd: 60,
    evidence: [
      {
        sourceUrl: "https://example.com/quote",
        observedAt: "2026-08-09T00:00:00.000Z",
        evidenceType: "WHOLESALE_CATALOG"
      }
    ],
    exportVerified: true,
    culturalUseVerified: true,
    ownerApproved: false,
    ...overrides
  };
}

describe("BOTANICA product opportunity scoring", () => {
  it("produces an eligible opportunity when hard gates and evidence pass", () => {
    const result = evaluateProductOpportunity(
      {
        id: "opp-1",
        productName: "Iroke Ifa",
        quote: baseQuote(),
        provenanceScore: 90,
        supplierReliabilityScore: 80,
        demandScore: 70,
        catalogGapScore: 90
      },
      { now: new Date("2026-08-09T12:00:00.000Z") }
    );

    expect(result.eligibleForCouncil).toBe(true);
    expect(result.tier).not.toBe("HOLD");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("holds a high-scoring candidate when provenance is insufficient", () => {
    const result = evaluateProductOpportunity(
      {
        id: "opp-2",
        productName: "Iroke Ifa",
        quote: baseQuote(),
        provenanceScore: 40,
        supplierReliabilityScore: 95,
        demandScore: 100,
        catalogGapScore: 100
      },
      { now: new Date("2026-08-09T12:00:00.000Z") }
    );

    expect(result.eligibleForCouncil).toBe(false);
    expect(result.tier).toBe("HOLD");
    expect(result.hardGateReasons).toContain("provenance evidence score is below 60");
  });

  it("holds Nigeria-direct product when export verification fails", () => {
    const result = evaluateProductOpportunity(
      {
        id: "opp-3",
        productName: "Ajere Ifa",
        quote: baseQuote({ exportVerified: false }),
        provenanceScore: 95,
        supplierReliabilityScore: 90
      },
      { now: new Date("2026-08-09T12:00:00.000Z") }
    );

    expect(result.eligibleForCouncil).toBe(false);
    expect(result.hardGateReasons).toContain("Nigeria-direct exportability is not verified");
  });

  it("ranks eligible opportunities ahead of held candidates", () => {
    const ranked = rankProductOpportunities([
      {
        id: "hold",
        productName: "Unverified item",
        quote: baseQuote({ id: "q-hold" }),
        provenanceScore: 10,
        supplierReliabilityScore: 90,
        demandScore: 100,
        catalogGapScore: 100
      },
      {
        id: "go",
        productName: "Verified Iroke Ifa",
        quote: baseQuote({ id: "q-go" }),
        provenanceScore: 90,
        supplierReliabilityScore: 85,
        demandScore: 70,
        catalogGapScore: 80
      }
    ]);

    expect(ranked[0]?.id).toBe("go");
    expect(ranked[0]?.eligibleForCouncil).toBe(true);
    expect(ranked[1]?.tier).toBe("HOLD");
  });
});
