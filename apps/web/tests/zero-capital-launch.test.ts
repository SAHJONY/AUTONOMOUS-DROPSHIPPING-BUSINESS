import { describe, expect, it } from "vitest";
import { assessZeroCapitalCandidate } from "../lib/zero-capital-launch";

const ready = { wholesalePrice: 20, shippingCost: 3, handlingCost: 2, markupPercent: 100, currency: "USD", usdExchangeRate: 1, moq: 1, supplierProcessingDays: 2, importTransitDays: 0, handlingDays: 1, customerShippingDays: 4, inventoryStatus: "IN_STOCK", inventoryVerifiedAt: "2026-08-11T00:00:00Z", resaleAuthorizationStatus: "VERIFIED", authorizationReference: "owner-file-1" };

describe("zero-capital launch gate", () => {
  it("accepts only a fully covered single-unit order", () => { const result = assessZeroCapitalCandidate(ready); expect(result.eligible).toBe(true); expect(result.cashAfterPurchaseUsd).toBeGreaterThanOrEqual(0); });
  it("fails closed on MOQ, inventory, authorization, timing, or cash deficits", () => { const result = assessZeroCapitalCandidate({ ...ready, moq: 12, inventoryStatus: "UNKNOWN", resaleAuthorizationStatus: "PENDING", supplierProcessingDays: 35, markupPercent: 0 }); expect(result.eligible).toBe(false); expect(result.blockers.length).toBeGreaterThanOrEqual(4); });
});
