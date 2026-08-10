import { describe, expect, it } from "vitest";
import { SUPPLIER_CANDIDATES } from "../lib/botanica/supplier-match";
import { WHOLESALE_PRODUCT_EVIDENCE, publiclyPricedWholesaleProducts } from "../lib/botanica/wholesale-products";

describe("BOTANICA wholesale sourcing registry", () => {
  it("contains verified B2B botanica suppliers", () => {
    const verified = SUPPLIER_CANDIDATES.filter((supplier) => supplier.verification_status === "VERIFIED");
    expect(verified.length).toBeGreaterThanOrEqual(5);
    expect(verified.some((supplier) => supplier.id === "yoruba-distribuidores")).toBe(true);
    expect(verified.some((supplier) => supplier.id === "distribuidora-mas-alla")).toBe(true);
  });

  it("stores concrete wholesaler product evidence", () => {
    expect(WHOLESALE_PRODUCT_EVIDENCE.length).toBeGreaterThanOrEqual(10);
    expect(WHOLESALE_PRODUCT_EVIDENCE.some((item) => item.id === "yoruba-opon-ifa")).toBe(true);
    expect(WHOLESALE_PRODUCT_EVIDENCE.some((item) => item.id === "soulstar-florida-water-12")).toBe(true);
  });

  it("never treats public wholesaler evidence as Shopify draft authority", () => {
    expect(WHOLESALE_PRODUCT_EVIDENCE.every((item) => item.shopify_draft_ready === false)).toBe(true);
    expect(WHOLESALE_PRODUCT_EVIDENCE.every((item) => item.required_next_checks.includes("OWNER_REVIEW"))).toBe(true);
  });

  it("keeps explicit prices only where public wholesale price evidence exists", () => {
    expect(publiclyPricedWholesaleProducts.length).toBeGreaterThanOrEqual(6);
    expect(publiclyPricedWholesaleProducts.every((item) => typeof item.wholesale_price_usd === "number")).toBe(true);
  });
});
