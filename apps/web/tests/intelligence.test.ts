import { describe, expect, it } from "vitest";
import { BOTANICA_FIRST_25_SKU_CANDIDATES } from "@/lib/botanica-first-25-sku-candidates";
import { buildAssortmentGap, suppliersToResearch } from "@/lib/intelligence";
import { intelligenceBriefing } from "@/lib/autonomy";

const first = BOTANICA_FIRST_25_SKU_CANDIDATES[0];
const second = BOTANICA_FIRST_25_SKU_CANDIDATES[1];

describe("the assortment gap sweep", () => {
  it("reports the whole basket missing for an empty catalog", () => {
    const gap = buildAssortmentGap([]);
    expect(gap.covered).toBe(0);
    expect(gap.coveragePercent).toBe(0);
    expect(gap.missing).toHaveLength(BOTANICA_FIRST_25_SKU_CANDIDATES.length);
    expect(gap.total).toBe(BOTANICA_FIRST_25_SKU_CANDIDATES.length);
  });

  it("counts a candidate as covered by SKU", () => {
    const gap = buildAssortmentGap([{ sku: first.sku, title: "otro título" }]);
    expect(gap.covered).toBe(1);
    expect(gap.missing.map((m) => m.sku)).not.toContain(first.sku);
  });

  it("counts a candidate as covered by title when the SKU was never set", () => {
    const gap = buildAssortmentGap([{ title: first.title }]);
    expect(gap.covered).toBe(1);
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    const gap = buildAssortmentGap([{ sku: `  ${first.sku.toLowerCase()}  ` }]);
    expect(gap.covered).toBe(1);
  });

  it("does not credit a blank SKU against every candidate", () => {
    const gap = buildAssortmentGap([{ sku: "", title: "" }, { sku: "   " }]);
    expect(gap.covered).toBe(0);
  });

  it("ranks P1 gaps ahead of the rest so the worklist is prioritized", () => {
    const gap = buildAssortmentGap([]);
    const priorities = gap.missing.map((m) => m.priority);
    const lastP1 = priorities.lastIndexOf("P1");
    const firstNonP1 = priorities.findIndex((p) => p !== "P1");
    expect(gap.p1Missing).toBeGreaterThan(0);
    if (firstNonP1 !== -1) expect(lastP1).toBeLessThan(firstNonP1);
  });

  it("carries the next action and missing evidence for each gap", () => {
    const gap = buildAssortmentGap([]);
    for (const item of gap.missing) {
      expect(item.nextAction.length).toBeGreaterThan(0);
      expect(Array.isArray(item.missingEvidence)).toBe(true);
    }
  });

  it("tracks coverage as the catalog fills in", () => {
    const gap = buildAssortmentGap([{ sku: first.sku }, { sku: second.sku }]);
    expect(gap.covered).toBe(2);
    expect(gap.coveragePercent).toBeCloseTo(2 / BOTANICA_FIRST_25_SKU_CANDIDATES.length * 100, 1);
  });

  it("de-duplicates the suppliers worth researching", () => {
    const suppliers = suppliersToResearch(buildAssortmentGap([]));
    expect(suppliers.length).toBe(new Set(suppliers).size);
    expect(suppliers.every((s) => s.trim().length > 0)).toBe(true);
  });
});

describe("the shift briefing", () => {
  it("says nothing when the sweep found nothing to say", () => {
    expect(intelligenceBriefing({})).toBe("");
  });

  it("hands the shift the coverage, the P1 gap and where to find the full list", () => {
    const briefing = intelligenceBriefing({ intelligence: { coverage_percent: 12.5, p1_missing: 9, researched: 0, discovered: 0 } });
    expect(briefing).toContain("12.5%");
    expect(briefing).toContain("9 SKU");
    expect(briefing).toContain("intelligence:assortment-gap");
  });

  it("mentions new trade research only when there was some", () => {
    const none = intelligenceBriefing({ intelligence: { coverage_percent: 0, p1_missing: 1, researched: 0, discovered: 0 } });
    expect(none).not.toContain("trade:");
    const some = intelligenceBriefing({ intelligence: { coverage_percent: 0, p1_missing: 1, researched: 3, discovered: 0 } });
    expect(some).toContain("3 proveedores");
  });

  it("points the shift at newly discovered suppliers and at the verification they need", () => {
    const briefing = intelligenceBriefing({ intelligence: { coverage_percent: 0, p1_missing: 1, researched: 0, discovered: 4 } });
    expect(briefing).toContain("4 proveedores candidatos");
    expect(briefing).toContain("supplier-candidate:");
    expect(briefing).toContain("verificación del propietario");
  });

  it("reports a competitor re-price only when prices actually moved", () => {
    expect(intelligenceBriefing({ competitor_scan: { scanned: 5, updated: 0, failed: 5 } })).toBe("");
    expect(intelligenceBriefing({ competitor_scan: { scanned: 5, updated: 2, failed: 0 } })).toContain("2 precios");
  });
});
