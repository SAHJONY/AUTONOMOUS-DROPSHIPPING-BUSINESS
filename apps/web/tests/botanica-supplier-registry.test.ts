import { describe, expect, it } from "vitest";
import {
  BOTANICA_SUPPLIERS,
  getBotanicaSuppliersByPolicy,
  hasBotanicaSupplierPolicy
} from "../lib/botanica-supplier-registry";

describe("botanica supplier registry", () => {
  it("keeps every supplier traceable and uniquely identified", () => {
    expect(BOTANICA_SUPPLIERS.length).toBeGreaterThanOrEqual(39);
    expect(new Set(BOTANICA_SUPPLIERS.map((supplier) => supplier.id)).size).toBe(BOTANICA_SUPPLIERS.length);

    for (const supplier of BOTANICA_SUPPLIERS) {
      expect(supplier.website).toMatch(/^https:\/\//);
      expect(supplier.sourceEvidence.length).toBeGreaterThan(0);
      expect(supplier.sourceEvidence.every((source) => source.startsWith("https://"))).toBe(true);
    }
  });

  it("allows evidence-backed suppliers to serve more than one commercial line", () => {
    const religious = getBotanicaSuppliersByPolicy("CORE_RELIGIOUS");
    expect(religious.length).toBeGreaterThanOrEqual(15);
    expect(religious.some((supplier) => supplier.id === "herramientas-santeria-miami")).toBe(true);
    expect(religious.some((supplier) => supplier.id === "pedro-yoruba-jewelry-miami")).toBe(true);
    expect(hasBotanicaSupplierPolicy(religious[0], "CORE_RELIGIOUS")).toBe(true);
    expect(getBotanicaSuppliersByPolicy("NIGERIA_YORUBA").some((supplier) => supplier.id === "inshe-miami")).toBe(true);
    expect(getBotanicaSuppliersByPolicy("PALO").some((supplier) => supplier.id === "nelstar-services-online")).toBe(true);
  });
});
