import { describe, expect, it } from "vitest";
import { mergeShopifyCatalogIntoProducts } from "../lib/owner-catalog-shopify";
import type { Product } from "../lib/types";

const existing: Product = {
  id:"internal-1", org_id:"org-1", title:"Old title", description:"old", source:"owner_manual",
  supplier_url:"https://supplier.example/item", supplier:"Verified supplier", cost:4, price:8,
  status:"discovered", shopify_id:101, created_at:"2026-01-01T00:00:00Z",
};

describe("Owner Shopify catalog import", () => {
  it("imports active, draft and archived Shopify products", () => {
    const merged = mergeShopifyCatalogIntoProducts("org-1", "store.myshopify.com", [], [
      { id:1, title:"Active", handle:"active", status:"active", variants:[{ id:11, price:"9.99" }] },
      { id:2, title:"Draft", handle:"draft", status:"draft", variants:[{ id:22, price:"5" }] },
      { id:3, title:"Archived", handle:"archived", status:"archived", variants:[{ id:33, price:"4" }] },
    ]);
    expect(merged.map(product => product.status)).toEqual(["launched", "discovered", "killed"]);
    expect(merged.map(product => product.shopify_id)).toEqual([1, 2, 3]);
  });

  it("lets Shopify refresh commerce fields while preserving private economics", () => {
    const [product] = mergeShopifyCatalogIntoProducts("org-1", "store.myshopify.com", [existing], [
      { id:101, title:"Current Shopify title", handle:"current", status:"active", vendor:"Shopify vendor", body_html:"<p>Current description</p>", variants:[{ id:1001, price:"12.50", sku:"SKU-1" }] },
    ]);
    expect(product).toMatchObject({ id:"internal-1", title:"Current Shopify title", description:"Current description", price:12.5, cost:4, supplier:"Verified supplier", shopify_variant_id:1001, sku:"SKU-1", status:"launched" });
  });

  it("keeps app-only products that are not in Shopify", () => {
    const appOnly = { ...existing, id:"app-only", shopify_id:undefined };
    const merged = mergeShopifyCatalogIntoProducts("org-1", "store.myshopify.com", [appOnly], []);
    expect(merged).toEqual([appOnly]);
  });
});
