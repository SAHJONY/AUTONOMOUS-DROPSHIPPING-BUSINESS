import { describe, expect, it } from "vitest";
import {
  BOTANICA_REAL_CATALOG_SEEDS,
  isBotanicaManagedProduct,
} from "../lib/botanica-shopify-migration";

describe("BOTANICA Shopify catalog migration policy", () => {
  it("seeds a curated real catalog without duplicate titles", () => {
    expect(BOTANICA_REAL_CATALOG_SEEDS).toHaveLength(10);
    const titles = BOTANICA_REAL_CATALOG_SEEDS.map((p) => p.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    expect(BOTANICA_REAL_CATALOG_SEEDS.every((p) => p.sourceUrl.startsWith("https://"))).toBe(true);
  });

  it("recognizes only explicitly managed BOTANICA products", () => {
    expect(isBotanicaManagedProduct({
      id: 1,
      title: "Opon Ifa",
      vendor: "BOTANICA OCHOSI",
      tags: "CURATED_REAL_CATALOG",
    })).toBe(true);

    expect(isBotanicaManagedProduct({
      id: 2,
      title: "Old Gadget",
      vendor: "SAHJONY",
      tags: "Trending, Featured, Autonomous",
    })).toBe(false);
  });

  it("keeps tradition and provenance explicit for every seed", () => {
    for (const seed of BOTANICA_REAL_CATALOG_SEEDS) {
      expect(seed.tradition).toMatch(/^(YORUBA_IFA_ISESE|LUCUMI_OCHA|YORUBA_CRAFT)$/);
      expect(seed.sourceSupplier.length).toBeGreaterThan(2);
      expect(seed.description).not.toMatch(/guaranteed|cures?|heals? disease/i);
    }
  });
});
