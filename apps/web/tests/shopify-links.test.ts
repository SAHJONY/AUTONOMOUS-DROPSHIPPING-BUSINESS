import { describe, expect, it } from "vitest";
import { getShopifyOwnerLinks } from "../lib/shopify-links";

describe("Shopify owner links", () => {
  it("builds storefront and admin links for a canonical shop", () => {
    expect(getShopifyOwnerLinks("Botanica-Ochosi.myshopify.com")).toEqual({
      storefront: "https://botanica-ochosi.myshopify.com",
      admin: "https://admin.shopify.com/store/botanica-ochosi"
    });
  });

  it("fails closed for untrusted domains", () => {
    expect(getShopifyOwnerLinks("evil.example.com")).toBeNull();
    expect(getShopifyOwnerLinks("shop.myshopify.com.evil.example")).toBeNull();
    expect(getShopifyOwnerLinks(null)).toBeNull();
  });
});
