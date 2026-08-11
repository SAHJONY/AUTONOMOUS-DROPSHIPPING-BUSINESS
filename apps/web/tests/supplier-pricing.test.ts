import { describe, expect, it } from "vitest";
import { calculateSupplierRetailPrice } from "../lib/supplier-pricing";

describe("supplier retail pricing", () => {
  it("adds a 35 percent markup plus shipping and handling", () => {
    expect(calculateSupplierRetailPrice({ wholesalePrice: 10, shippingCost: 2, handlingCost: 1 })).toBe(16.5);
  });

  it("never permits negative cost components", () => {
    expect(calculateSupplierRetailPrice({ wholesalePrice: 10, shippingCost: -5, handlingCost: -2 })).toBe(13.5);
  });
});
