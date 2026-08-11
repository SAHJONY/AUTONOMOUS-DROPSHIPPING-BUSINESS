import { describe, expect, it } from "vitest";
import { calculateSupplierDealIntelligence } from "../lib/supplier-deal-intelligence";

describe("supplier deal intelligence", () => {
  it("calculates retail, wholesale, MOQ investment and profits", () => {
    const result = calculateSupplierDealIntelligence({ wholesalePrice: 10, shippingCost: 2, handlingCost: 1, currency: "USD", usdExchangeRate: 1, moq: 12, botanicaWholesaleEnabled: true, botanicaWholesalePrice: 16, botanicaWholesaleMoq: 24, supplierProcessingDays: 3, importTransitDays: 7, handlingDays: 2, customerShippingDays: 4 });
    expect(result.landedUnitCostUsd).toBe(13);
    expect(result.retailPriceUsd).toBe(16.5);
    expect(result.retailProfitPerUnitUsd).toBe(3.5);
    expect(result.botanicaWholesalePriceUsd).toBe(16);
    expect(result.botanicaOrderProfitUsd).toBe(72);
    expect(result.supplierMinimumInvestmentUsd).toBe(156);
    expect(result.totalDays).toBe(16);
  });

  it("fails closed when a foreign exchange rate is missing", () => {
    const result = calculateSupplierDealIntelligence({ wholesalePrice: 1000, currency: "NGN", usdExchangeRate: 0 });
    expect(result.fxReady).toBe(false);
    expect(result.retailPriceUsd).toBe(0);
  });

  it("never recommends wholesale below a twenty percent gross markup", () => {
    const result = calculateSupplierDealIntelligence({ wholesalePrice: 10, currency: "USD", botanicaWholesaleEnabled: true, botanicaWholesalePrice: 5 });
    expect(result.botanicaWholesalePriceUsd).toBe(12);
  });
});
