import { describe, expect, it } from "vitest";
import { PREACCOUNT_SUPPLIER_CATALOGS, preaccountCatalogStats } from "../lib/preaccount-supplier-catalogs";

describe("pre-account supplier catalog staging", () => {
  it("keeps catalog access ready without inventing sellable SKUs", () => {
    expect(PREACCOUNT_SUPPLIER_CATALOGS.length).toBeGreaterThanOrEqual(8);
    expect(preaccountCatalogStats().dropshipConfirmed).toBeGreaterThanOrEqual(7);
    for (const source of PREACCOUNT_SUPPLIER_CATALOGS) {
      expect(source.catalogUrl).toMatch(/^https:\/\//);
      expect(source.applicationUrl).toMatch(/^(https:\/\/|mailto:)/);
      expect(source.publicCategories.length).toBeGreaterThan(0);
      expect(source.requirements.length).toBeGreaterThan(0);
      expect(source.contacts.length).toBeGreaterThan(0);
      expect(source.firstRequest.length).toBeGreaterThan(20);
      expect(source).not.toHaveProperty("wholesalePrice");
      expect(source).not.toHaveProperty("inventoryQuantity");
    }
  });
});
