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

describe("freight mode", () => {
  const base = { wholesalePrice: 2, shippingCost: 500, handlingCost: 0, markupPercent: 150, currency: "USD", usdExchangeRate: 1, moq: 100 };

  it("reads shipping per unit unless told otherwise, exactly as before", () => {
    const deal = calculateSupplierDealIntelligence(base);
    expect(deal.freightMode).toBe("PER_UNIT");
    expect(deal.landedUnitCostUsd).toBe(502); // $2 + $500 freight on every single unit
  });

  it("spreads a batch-priced shipment across the units it carries", () => {
    const deal = calculateSupplierDealIntelligence({ ...base, freightMode: "PER_SHIPMENT" });
    expect(deal.landedUnitCostUsd).toBe(7); // $2 + $500/100
    expect(deal.inboundFreightPerOrderUsd).toBe(500);
  });

  it("prices retail off the amortized freight, not the batch total", () => {
    const perShipment = calculateSupplierDealIntelligence({ ...base, freightMode: "PER_SHIPMENT" });
    const perUnit = calculateSupplierDealIntelligence(base);
    expect(perShipment.retailPriceUsd).toBeLessThan(perUnit.retailPriceUsd);
    expect(perShipment.retailProfitPerUnitUsd).toBeGreaterThan(0);
  });

  it("treats a single-unit order the same either way", () => {
    const one = { ...base, moq: 1 };
    expect(calculateSupplierDealIntelligence({ ...one, freightMode: "PER_SHIPMENT" }).landedUnitCostUsd)
      .toBe(calculateSupplierDealIntelligence(one).landedUnitCostUsd);
  });

  it("turns a batch quote from unsellable into viable — the whole point", () => {
    const asAir = calculateSupplierDealIntelligence(base);
    const asSea = calculateSupplierDealIntelligence({ ...base, freightMode: "PER_SHIPMENT" });
    expect(asAir.retailMarginPercent).toBeLessThan(asSea.retailMarginPercent);
    expect(asSea.supplierMinimumInvestmentUsd).toBeLessThan(asAir.supplierMinimumInvestmentUsd);
  });
});
