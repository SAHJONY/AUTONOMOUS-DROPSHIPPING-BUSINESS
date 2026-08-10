import { describe, expect, it } from "vitest";
import { SUPPLIER_CANDIDATES } from "../lib/botanica/supplier-match";
import { FIRST_100_WHOLESALE_PRODUCTS, first100PubliclyPricedProducts } from "../lib/botanica/wholesale-products-first100";

describe("BOTANICA wholesale sourcing registry", () => {
  it("contains verified B2B botanica suppliers", () => {
    const verified = SUPPLIER_CANDIDATES.filter((supplier) => supplier.verification_status === "VERIFIED");
    expect(verified.length).toBeGreaterThanOrEqual(5);
    expect(verified.some((supplier) => supplier.id === "yoruba-distribuidores")).toBe(true);
    expect(verified.some((supplier) => supplier.id === "distribuidora-mas-alla")).toBe(true);
  });

  it("contains exactly the first 100 wholesale product evidence records", () => {
    expect(FIRST_100_WHOLESALE_PRODUCTS).toHaveLength(100);
    expect(new Set(FIRST_100_WHOLESALE_PRODUCTS.map((item) => item.id)).size).toBe(100);
    expect(FIRST_100_WHOLESALE_PRODUCTS.some((item) => item.id === "yoruba-opon-ifa")).toBe(true);
    expect(FIRST_100_WHOLESALE_PRODUCTS.some((item) => item.id === "soulstar-florida-water-12")).toBe(true);
    expect(FIRST_100_WHOLESALE_PRODUCTS.some((item) => item.id === "masalla-bath-abre-caminos")).toBe(true);
    expect(FIRST_100_WHOLESALE_PRODUCTS.some((item) => item.id === "masalla-oil-dominante")).toBe(true);
    expect(FIRST_100_WHOLESALE_PRODUCTS.some((item) => item.id === "masalla-powder-7-potencias")).toBe(true);
    expect(FIRST_100_WHOLESALE_PRODUCTS.some((item) => item.id === "masalla-perfume-21-division")).toBe(true);
  });

  it("never treats wholesaler evidence as Shopify draft authority", () => {
    expect(FIRST_100_WHOLESALE_PRODUCTS.every((item) => item.shopify_draft_ready === false)).toBe(true);
    expect(FIRST_100_WHOLESALE_PRODUCTS.every((item) => item.required_next_checks.includes("OWNER_REVIEW"))).toBe(true);
  });

  it("keeps explicit prices only where public wholesale price evidence exists", () => {
    expect(first100PubliclyPricedProducts.length).toBeGreaterThanOrEqual(90);
    expect(first100PubliclyPricedProducts.every((item) => typeof item.wholesale_price_usd === "number")).toBe(true);
  });
});
