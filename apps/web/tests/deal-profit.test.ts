import { describe, expect, it } from "vitest";
import { calculateDealProfit } from "../lib/deal-profit";

describe("deal profit calculator", () => {
  it("includes every disclosed deal cost", () => {
    expect(calculateDealProfit({ quantity: 10, unitPrice: 20, unitCost: 10, supplierShipping: 10, customerShipping: 5, handling: 5, paymentFeePercent: 3, advertising: 10, taxesAndDuties: 4, otherCosts: 0 })).toEqual({ quantity: 10, revenue: 200, merchandiseCost: 100, paymentFees: 6, totalCosts: 140, netProfit: 60, profitPerUnit: 6, marginPercent: 30, breakEvenUnitPrice: 14 });
  });

  it("shows losses instead of hiding them", () => {
    expect(calculateDealProfit({ quantity: 1, unitPrice: 5, unitCost: 10, supplierShipping: 0, customerShipping: 0, handling: 0, paymentFeePercent: 0, advertising: 0, taxesAndDuties: 0, otherCosts: 0 }).netProfit).toBe(-5);
  });
});
