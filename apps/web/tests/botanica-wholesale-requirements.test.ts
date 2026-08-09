import { describe, expect, it } from "vitest";
import { evaluateWholesaleOnboardingReadiness } from "../lib/botanica-wholesale-requirements";

describe("BOTANICA wholesale onboarding requirements", () => {
  it("holds Yoruba Imports first-order onboarding without tax documentation", () => {
    const result = evaluateWholesaleOnboardingReadiness({
      supplierId: "yoruba-imports-miami-gardens",
      hasCurrentTaxOrResaleCertificate: false,
      intendedOrderUsd: 750,
      isFirstOrder: true
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("current sales-tax or tax-exempt documentation is required");
  });

  it("enforces the public first-order threshold", () => {
    const result = evaluateWholesaleOnboardingReadiness({
      supplierId: "yoruba-imports-miami-gardens",
      hasCurrentTaxOrResaleCertificate: true,
      intendedOrderUsd: 500,
      isFirstOrder: true
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("exceed $500.00"))).toBe(true);
  });

  it("never assumes unknown supplier requirements are satisfied", () => {
    const result = evaluateWholesaleOnboardingReadiness({
      supplierId: "unknown-supplier",
      hasCurrentTaxOrResaleCertificate: true,
      intendedOrderUsd: 1000,
      isFirstOrder: true
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("wholesale onboarding requirements are not yet evidenced");
  });
});
