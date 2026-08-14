import { describe, expect, it } from "vitest";
import { AZUREGREEN_PUBLIC_CATALOG_SEEDS } from "../lib/azuregreen-public-catalog";

describe("AzureGreen public reference catalog", () => {
  it("has unique stable IDs and supplier SKUs", () => {
    expect(new Set(AZUREGREEN_PUBLIC_CATALOG_SEEDS.map(item => item.id)).size).toBe(AZUREGREEN_PUBLIC_CATALOG_SEEDS.length);
    expect(new Set(AZUREGREEN_PUBLIC_CATALOG_SEEDS.map(item => item.sku)).size).toBe(AZUREGREEN_PUBLIC_CATALOG_SEEDS.length);
  });

  it("keeps source metadata for every historical reference", () => {
    for (const item of AZUREGREEN_PUBLIC_CATALOG_SEEDS) {
      expect(item.supplier).toBe("AzureGreen");
      expect(item.historicalPublicPriceUsd).toBeGreaterThan(0);
      expect(item.sourcePage).toBeGreaterThan(0);
    }
  });
});
