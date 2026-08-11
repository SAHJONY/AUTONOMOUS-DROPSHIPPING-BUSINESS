import { describe, expect, it } from "vitest";
import { SUPPLIER_CATALOG_DEMO_SEEDS } from "../lib/supplier-catalog-demo";

describe("supplier catalog demo products", () => {
  it("provides removable, source-linked Spanish-first examples", () => {
    expect(SUPPLIER_CATALOG_DEMO_SEEDS).toHaveLength(4);
    expect(new Set(SUPPLIER_CATALOG_DEMO_SEEDS.map((seed) => seed.id)).size).toBe(4);
    for (const seed of SUPPLIER_CATALOG_DEMO_SEEDS) {
      expect(seed.id).toMatch(/^demo-/);
      expect(seed.productUrl).toMatch(/^https:\/\//);
      expect(seed.notes).toContain("MUESTRA INTERNA");
      expect(seed.wholesalePrice).toBeGreaterThan(0);
    }
  });
});
