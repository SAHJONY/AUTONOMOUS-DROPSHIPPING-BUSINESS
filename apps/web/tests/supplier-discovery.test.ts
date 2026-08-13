import { describe, expect, it } from "vitest";
import { SUPPLIER_TIERS, buildDiscoveryQueries, classifySupplierTier, hostOf, scoreSupplierCandidate, tierForTick } from "@/lib/supplier-discovery";
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
    description: "Wholesale santeria religious supplies, MOQ 12 units, bulk pricing.",
  };

  it("accepts a niche wholesaler and classifies it as one", () => {
    const candidate = scoreSupplierCandidate(hit);
    expect(candidate).not.toBeNull();
    expect(candidate!.host).toBe("proveedor-ejemplo.com");
    expect(candidate!.tier).toBe("WHOLESALER");
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

  it("scores a niche page with no tier below a classified supplier", () => {
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

describe("supply-chain tiers", () => {
  it("recognizes each tier in English and Spanish", () => {
    expect(classifySupplierTier("we are a candle manufacturer").tier).toBe("MANUFACTURER");
    expect(classifySupplierTier("fabricante de velas").tier).toBe("MANUFACTURER");
    expect(classifySupplierTier("authorized distributor").tier).toBe("DISTRIBUTOR");
    expect(classifySupplierTier("distribuidora nacional").tier).toBe("DISTRIBUTOR");
    expect(classifySupplierTier("wholesale, MOQ 12").tier).toBe("WHOLESALER");
    expect(classifySupplierTier("venta al por mayor").tier).toBe("WHOLESALER");
    expect(classifySupplierTier("reseller trade account").tier).toBe("RESELLER");
    expect(classifySupplierTier("revendedor autorizado").tier).toBe("RESELLER");
  });

  it("returns UNKNOWN rather than guessing when nothing identifies a tier", () => {
    const result = classifySupplierTier("santeria items for your home");
    expect(result.tier).toBe("UNKNOWN");
    expect(result.signals).toEqual([]);
  });

  it("takes the strongest tier when a page claims several", () => {
    // Factories routinely also say "wholesale" — the factory is the real fact.
    expect(classifySupplierTier("factory direct wholesale, MOQ 50, distributor pricing").tier).toBe("MANUFACTURER");
    expect(classifySupplierTier("distributor offering wholesale and reseller accounts").tier).toBe("DISTRIBUTOR");
  });

  it("ranks a manufacturer above a distributor above a wholesaler above a reseller", () => {
    const at = (text: string) => scoreSupplierCandidate({
      title: text, url: "https://proveedor-ejemplo.com", description: "santeria religious goods",
    })!.score;
    expect(at("fabricante")).toBeGreaterThan(at("distribuidor"));
    expect(at("distribuidor")).toBeGreaterThan(at("mayorista"));
    expect(at("mayorista")).toBeGreaterThan(at("revendedor"));
  });

  it("keeps resellers as candidates rather than filtering them out", () => {
    const candidate = scoreSupplierCandidate({
      title: "Revendedor de articulos de santeria",
      url: "https://revendedor-ejemplo.com",
      description: "trade account available",
    });
    expect(candidate).not.toBeNull();
    expect(candidate!.tier).toBe("RESELLER");
  });

  it("still rejects a consumer marketplace whatever tier it claims", () => {
    expect(scoreSupplierCandidate({
      title: "Wholesale santeria candles from the factory",
      url: "https://www.amazon.com/dp/B01",
      description: "manufacturer direct, MOQ 1",
    })).toBeNull();
  });

  it("asks each tier for itself in the words those businesses use", () => {
    const gapItem = gap();
    expect(buildDiscoveryQueries([gapItem], "MANUFACTURER")[0]).toContain("manufacturer factory OEM");
    expect(buildDiscoveryQueries([gapItem], "DISTRIBUTOR")[0]).toContain("distributor importer");
    expect(buildDiscoveryQueries([gapItem], "RESELLER")[0]).toContain("reseller trade account");
  });

  it("keeps every tier query inside the fail-closed niche gate", () => {
    for (const tier of SUPPLIER_TIERS) {
      for (const query of buildDiscoveryQueries([gap()], tier)) {
        expect(botanicaRelevantText(query)).toBe(true);
      }
    }
  });

  it("covers the whole supply chain across a day without raising query spend", () => {
    const hunted = new Set<string>();
    for (let hour = 0; hour < 24; hour++) hunted.add(tierForTick(new Date(Date.UTC(2026, 0, 1, hour))));
    expect(hunted.size).toBe(SUPPLIER_TIERS.length);
  });
});

describe("small-batch makers", () => {
  /**
   * Found in the wild: a Nashville workshop that pours its own oils scored
   * UNKNOWN because the vocabulary only knew factories. It is a manufacturer.
   */
  it("recognizes an artisan maker as a manufacturer", () => {
    expect(classifySupplierTier("Our workshop produces artisan-made oils, handmade in-house by practitioners").tier).toBe("MANUFACTURER");
    expect(classifySupplierTier("candles designed and poured in Los Angeles").tier).toBe("MANUFACTURER");
    expect(classifySupplierTier("productos artesanal hecho a mano en nuestro taller").tier).toBe("MANUFACTURER");
  });

  it("still ranks a maker above a reseller selling the same goods", () => {
    const score = (text: string) => scoreSupplierCandidate({ title: text, url: "https://ejemplo-santeria.com", description: "santeria botanica" })!.score;
    expect(score("handmade in-house")).toBeGreaterThan(score("revendedor"));
  });

  it("does not promote a shop that merely stocks handmade goods", () => {
    // "handmade" alone describes the product, not who made it.
    expect(classifySupplierTier("we sell handmade candles from local artists").tier).not.toBe("MANUFACTURER");
  });
});

describe("Spanish manufacturing words in full", () => {
  /**
   * "fabricación" used to match only because "fabrica" sits inside it. Relying
   * on a substring coincidence for a real word is not a rule.
   */
  it("recognizes the noun forms, not just the agent noun", () => {
    for (const phrase of ["fabricacion personalizada", "fabricación propia", "manufactura de velas", "produccion propia"]) {
      expect(classifySupplierTier(`${phrase} para botanica`).tier).toBe("MANUFACTURER");
    }
  });
});
