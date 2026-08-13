import { describe, expect, it } from "vitest";
import { draftOutreachForBench, draftSupplierOutreach, TIER_OPENING } from "@/lib/supplier-outreach";

describe("what to ask each tier first", () => {
  it("asks a manufacturer about private label — the only tier that can do it", () => {
    const draft = draftSupplierOutreach({ host: "lazarobrand.com", title: "Lazaro Brand", tier: "MANUFACTURER" });
    expect(draft.kind).toBe("PRIVATE_LABEL");
    expect(draft.subject).toContain("marca privada");
    expect(draft.reason).toContain("marca propia");
  });

  it("asks distributors and wholesalers for a trade account", () => {
    expect(draftSupplierOutreach({ host: "el-masalla.com", tier: "DISTRIBUTOR" }).kind).toBe("WHOLESALE_ACCOUNT");
    expect(draftSupplierOutreach({ host: "originalbotanica.com", tier: "WHOLESALER" }).kind).toBe("WHOLESALE_ACCOUNT");
  });

  it("asks a reseller for catalog and pricing, because the margin decides it", () => {
    expect(draftSupplierOutreach({ host: "revendedor.com", tier: "RESELLER" }).kind).toBe("CATALOG_QUOTE");
  });

  it("has an opening for every tier, including unclassified", () => {
    for (const kind of Object.values(TIER_OPENING)) expect(kind.length).toBeGreaterThan(0);
    expect(draftSupplierOutreach({ host: "unknown.com" }).kind).toBe("CATALOG_QUOTE");
    expect(draftSupplierOutreach({ host: "unknown.com", tier: "NONSENSE" }).tier).toBe("UNKNOWN");
  });
});

describe("the draft itself", () => {
  it("addresses the company by name rather than a placeholder", () => {
    const draft = draftSupplierOutreach({ host: "indioproducts.com", title: "Indio Products", tier: "MANUFACTURER" });
    expect(draft.body).toContain("Indio Products");
    expect(draft.body).not.toContain("[NOMBRE DEL PROVEEDOR]");
  });

  it("falls back to the host when no company name was captured", () => {
    const draft = draftSupplierOutreach({ host: "proveedor.com", title: "   ", tier: "WHOLESALER" });
    expect(draft.supplierName).toBe("proveedor.com");
    expect(draft.body).toContain("proveedor.com");
  });

  it("keeps the clause that nothing is authorized until written confirmation", () => {
    const draft = draftSupplierOutreach({ host: "x.com", tier: "WHOLESALER" });
    expect(draft.body).toContain("Ningún pedido quedará autorizado");
  });

  it("writes English when asked", () => {
    const draft = draftSupplierOutreach({ host: "x.com", title: "X Co", tier: "MANUFACTURER" }, "en");
    expect(draft.body).toContain("Dear X Co team");
    expect(draft.subject).toContain("Private-label");
  });

  it("never marks anything as sent — the owner sends these", () => {
    expect(draftSupplierOutreach({ host: "x.com" }).sent).toBe(false);
  });

  it("honours an explicit override when the owner wants a different opening", () => {
    const draft = draftSupplierOutreach({ host: "x.com", tier: "MANUFACTURER" }, "es", "SAMPLE_ORDER");
    expect(draft.kind).toBe("SAMPLE_ORDER");
  });
});

describe("the bench, in the order worth working", () => {
  it("puts the manufacturer first and the reseller last", () => {
    const drafts = draftOutreachForBench([
      { host: "revendedor.com", tier: "RESELLER", score: 90 },
      { host: "mayorista.com", tier: "WHOLESALER", score: 60 },
      { host: "fabrica.com", tier: "MANUFACTURER", score: 10 },
      { host: "distribuidor.com", tier: "DISTRIBUTOR", score: 70 },
    ]);
    expect(drafts.map((d) => d.host)).toEqual(["fabrica.com", "distribuidor.com", "mayorista.com", "revendedor.com"]);
  });

  it("handles an empty bench without inventing anything", () => {
    expect(draftOutreachForBench([])).toEqual([]);
  });
});
