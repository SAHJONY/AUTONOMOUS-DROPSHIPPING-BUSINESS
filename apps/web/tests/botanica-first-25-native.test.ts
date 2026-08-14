import { describe, expect, it } from "vitest";
import { productionCatalogReadiness, seedFirst25NativeDrafts } from "../lib/botanica-first-25-native";
import type { Product } from "../lib/types";

describe("first 25 native catalog intake", () => {
  it("creates 25 real-source HOLD drafts without invented commerce data", () => {
    const result = seedFirst25NativeDrafts("org-1", [], "2026-08-14T00:00:00Z");
    expect(result.created).toHaveLength(25);
    expect(new Set(result.created.map((product) => product.sku)).size).toBe(25);
    for (const product of result.created) {
      expect(product).toMatchObject({ org_id:"org-1", status:"discovered", cost:0, price:0, inventory_quantity:0, inventory_policy:"deny" });
      expect(product.supplier_url).toMatch(/^https:\/\//);
      expect(product.supplier).toBeTruthy();
    }
  });

  it("is idempotent by SKU", () => {
    const first = seedFirst25NativeDrafts("org-1", []);
    const second = seedFirst25NativeDrafts("org-1", first.products);
    expect(second.created).toHaveLength(0);
    expect(second.products).toHaveLength(25);
  });

  it("requires all 25 products to satisfy every production field", () => {
    const draft = seedFirst25NativeDrafts("org-1", []).products[0];
    const ready: Product = { ...draft, status:"launched", cost:5, price:12, inventory_quantity:4, image_url:"https://example.com/item.jpg", provenance_verified_at:"2026-08-14", shipping_weight_oz:8, package_length_in:4, package_width_in:3, package_height_in:2 };
    expect(productionCatalogReadiness(Array.from({ length:24 }, (_, index) => ({ ...ready, id:`p${index}`, sku:`SKU-${index}` })))).toMatchObject({ ready:24, productionReady:false });
    expect(productionCatalogReadiness(Array.from({ length:25 }, (_, index) => ({ ...ready, id:`p${index}`, sku:`SKU-${index}` })))).toMatchObject({ ready:25, productionReady:true });
  });
});
