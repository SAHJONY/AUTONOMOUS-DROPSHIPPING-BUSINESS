import { describe, expect, it } from "vitest";
import { BOTANICA_STORE_CATEGORIES, isBotanicaStoreCategory } from "../lib/botanica-store-categories";
import { toNativeCatalog } from "../lib/native-commerce";
import type { Product } from "../lib/types";

describe("BOTANICA store categories", () => {
  it("contains the requested taxonomy without duplicates", () => {
    expect(BOTANICA_STORE_CATEGORIES).toHaveLength(46);
    expect(new Set(BOTANICA_STORE_CATEGORIES).size).toBe(BOTANICA_STORE_CATEGORIES.length);
    expect(isBotanicaStoreCategory("VELAS / CANDLES")).toBe(true);
    expect(isBotanicaStoreCategory("SOPERAS")).toBe(true);
    expect(isBotanicaStoreCategory("Unknown category")).toBe(false);
  });

  it("publishes the saved category to storefront filters", () => {
    const product: Product = { id:"p1", org_id:"o1", title:"Vela", description:"", category:"VELAS / CANDLES", source:"native", supplier_url:"", cost:1, price:5, status:"launched", created_at:"2026-01-01T00:00:00Z" };
    expect(toNativeCatalog([product])[0].category).toBe("VELAS / CANDLES");
  });
});
