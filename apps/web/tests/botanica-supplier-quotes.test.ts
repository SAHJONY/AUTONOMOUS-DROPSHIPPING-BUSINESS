import { describe, expect, it } from "vitest";
import {
  calculateLandedCostPerUnitUsd,
  canCommitPurchase,
  evaluateSupplierQuote,
  rankQuotesByLandedCost,
  type SupplierQuote
} from "../lib/botanica-supplier-quotes";

const now = new Date("2026-08-09T06:00:00.000Z");

function baseQuote(overrides: Partial<SupplierQuote> = {}): SupplierQuote {
  return {
    id: "quote-1",
    supplierId: "supplier-1",
    supplierName: "Supplier 1",
    productName: "Opon Ifa",
    countryOfOrigin: "Nigeria",
    tradition: "YORUBA_IFA_ISESE",
    currency: "USD",
    unitCost: 20,
    quantity: 10,
    freightTotal: 40,
    dutyTotal: 10,
    retailPriceUsd: 60,
    evidence: [
      {
        sourceUrl: "https://example.com/quote",
        observedAt: "2026-08-08T12:00:00.000Z",
        evidenceType: "WRITTEN_QUOTE"
      }
    ],
    exportVerified: true,
    culturalUseVerified: true,
    ownerApproved: false,
    ...overrides
  };
}

describe("Botanica supplier quote engine", () => {
  it("calculates landed cost per unit", () => {
    expect(calculateLandedCostPerUnitUsd(baseQuote())).toBe(25);
  });

  it("allows a fresh, profitable, culturally verified quote into Council review", () => {
    const evaluation = evaluateSupplierQuote(baseQuote(), { now });
    expect(evaluation.eligibleForCouncil).toBe(true);
    expect(evaluation.grossMarginPct).toBeCloseTo(58.3333, 3);
  });

  it("holds Nigeria-direct products when exportability is not verified", () => {
    const evaluation = evaluateSupplierQuote(baseQuote({ exportVerified: false }), { now });
    expect(evaluation.eligibleForCouncil).toBe(false);
    expect(evaluation.reasons).toContain("Nigeria-direct exportability is not verified");
  });

  it("holds tradition-specific products when cultural use is not verified", () => {
    const evaluation = evaluateSupplierQuote(baseQuote({ culturalUseVerified: false }), { now });
    expect(evaluation.eligibleForCouncil).toBe(false);
    expect(evaluation.reasons).toContain("tradition-specific cultural use is not verified");
  });

  it("holds stale evidence", () => {
    const quote = baseQuote({
      evidence: [
        {
          sourceUrl: "https://example.com/old",
          observedAt: "2026-05-01T00:00:00.000Z",
          evidenceType: "PUBLIC_PRICE"
        }
      ]
    });
    const evaluation = evaluateSupplierQuote(quote, { now });
    expect(evaluation.eligibleForCouncil).toBe(false);
    expect(evaluation.reasons).toContain("supplier/source evidence is stale or invalid");
  });

  it("does not allow a purchase without owner approval even after quote approval", () => {
    const quote = baseQuote();
    const evaluation = evaluateSupplierQuote(quote, { now });
    expect(canCommitPurchase(quote, evaluation)).toBe(false);
    expect(canCommitPurchase({ ...quote, ownerApproved: true }, evaluation)).toBe(true);
  });

  it("ranks comparable quotes by normalized landed cost", () => {
    const cheap = baseQuote({ id: "cheap", unitCost: 18, freightTotal: 20 });
    const expensive = baseQuote({ id: "expensive", unitCost: 25, freightTotal: 50 });
    const ranked = rankQuotesByLandedCost([expensive, cheap]);
    expect(ranked.map((entry) => entry.quote.id)).toEqual(["cheap", "expensive"]);
  });

  it("requires FX evidence input for NGN quotes before normalization", () => {
    const quote = baseQuote({ currency: "NGN", unitCost: 50000, fxRateToUsd: undefined });
    const evaluation = evaluateSupplierQuote(quote, { now });
    expect(evaluation.eligibleForCouncil).toBe(false);
    expect(evaluation.reasons).toContain("unit cost cannot be normalized to USD");
  });
});
