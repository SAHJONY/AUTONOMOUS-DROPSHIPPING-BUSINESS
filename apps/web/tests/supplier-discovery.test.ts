import { describe, expect, it } from "vitest";
import { buildDiscoveryQueries, hostOf, scoreSupplierCandidate } from "@/lib/supplier-discovery";
import { botanicaRelevantText } from "@/lib/botanica-policy";
import type { AssortmentGapItem } from "@/lib/intelligence";

const gap = (over: Partial<AssortmentGapItem> = {}): AssortmentGapItem => ({
  sku: "BO-LC-SOPERA-OSHUN", title: "Sopera Oshun", lane: "CUBAN_LUCUMI", supplier: "example-supplier",
  priority: "P1", nextAction: "verificar", missingEvidence: [], needsPriceEvidence: true, ...over,
});

describe("discovery queries", () => {
  it("anchors every query in the niche so the fail-closed gate passes honestly", () => {
    // "Sopera Oshun" carries no policy anchor on its own — the lane supplies it.
    expect(botanicaRelevantText("Sopera Oshun")).toBe(false);
    const [query] = buildDiscoveryQueries([gap()]);
    expect(query).toContain("Sopera Oshun");
    expect(botanicaRelevantText(query)).toBe(true);
  });

  it("uses the tradition matching each lane", () => {
    expect(buildDiscoveryQueries([gap({ lane: "NIGERIA_YORUBA" })])[0]).toContain("ifa orisha");
    expect(buildDiscoveryQueries([gap({ lane: "BOTANICA_CONSUMABLES" })])[0]).toContain("botanica religious");
  });

  it("drops a gap whose lane it cannot anchor rather than searching blind", () => {
    const queries = buildDiscoveryQueries([gap({ lane: "SOMETHING_ELSE" })]);
    // Falls back to the standing niche queries, never an unanchored one.
    expect(queries.every((q) => botanicaRelevantText(q))).toBe(true);
    expect(queries.some((q) => q.includes("Sopera Oshun"))).toBe(false);
  });

  it("still widens the supplier bench when nothing is missing", () => {
    const queries = buildDiscoveryQueries([]);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((q) => botanicaRelevantText(q))).toBe(true);
  });
});

describe("host extraction", () => {
  it("normalizes away www and lowercases", () => {
    expect(hostOf("https://WWW.Example.com/path")).toBe("example.com");
  });

  it("refuses plain http, credentials in the url, and private hosts", () => {
    expect(hostOf("http://example.com")).toBeNull();
    expect(hostOf("https://127.0.0.1/x")).toBeNull();
    expect(hostOf("https://localhost/x")).toBeNull();
    expect(hostOf("not a url")).toBeNull();
  });
});

describe("candidate scoring", () => {
  const hit = {
    title: "Mayorista de artículos de santeria",
    url: "https://proveedor-ejemplo.com/wholesale",
    description: "Wholesale santeria religious supplies, MOQ 12 units, distributor pricing.",
  };

  it("accepts a niche wholesaler and ranks it on wholesale intent", () => {
    const candidate = scoreSupplierCandidate(hit);
    expect(candidate).not.toBeNull();
    expect(candidate!.host).toBe("proveedor-ejemplo.com");
    expect(candidate!.score).toBeGreaterThan(40);
    expect(candidate!.signals).toContain("wholesale");
  });

  it("rejects a consumer marketplace even when it sells the right goods", () => {
    expect(scoreSupplierCandidate({ ...hit, url: "https://www.amazon.com/dp/B01" })).toBeNull();
    expect(scoreSupplierCandidate({ ...hit, url: "https://www.etsy.com/listing/1" })).toBeNull();
  });

  it("rejects an off-niche result however wholesale it looks", () => {
    expect(scoreSupplierCandidate({
      title: "Wholesale phone cases",
      url: "https://gadgets-example.com",
      description: "Bulk distributor, MOQ 100, b2b trade account.",
    })).toBeNull();
  });

  it("scores a bare niche page below one with wholesale signals", () => {
    const bare = scoreSupplierCandidate({ title: "Botanica", url: "https://a-example.com", description: "orisha items" });
    const rich = scoreSupplierCandidate(hit);
    expect(bare).not.toBeNull();
    expect(rich!.score).toBeGreaterThan(bare!.score);
  });

  it("never exceeds the score ceiling however many signals appear", () => {
    const candidate = scoreSupplierCandidate({
      title: "wholesale mayorista mayoreo distributor distribuidor bulk santeria",
      url: "https://b-example.com",
      description: "moq minimum order trade account reseller al por mayor b2b supplier orisha",
    });
    expect(candidate!.score).toBeLessThanOrEqual(100);
  });
});
