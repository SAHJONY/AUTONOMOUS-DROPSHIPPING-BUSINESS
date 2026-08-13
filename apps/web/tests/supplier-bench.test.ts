import { describe, expect, it } from "vitest";
import { BOTANICA_SUPPLIERS } from "@/lib/botanica-supplier-registry";
import { benchCountsByTier, buildSupplierBench, hostOfUrl, registryBench, tierOfRegistrySupplier } from "@/lib/supplier-bench";

describe("the registry is part of the bench", () => {
  /**
   * The bug this fixes: the owner console reported zero suppliers to a business
   * holding dozens of researched ones, because it only read web discovery.
   */
  it("puts every registered supplier on the bench", () => {
    expect(registryBench().length).toBe(BOTANICA_SUPPLIERS.length);
    expect(buildSupplierBench([]).length).toBe(BOTANICA_SUPPLIERS.length);
  });

  it("finds the manufacturers already on file", () => {
    const counts = benchCountsByTier(buildSupplierBench([]));
    expect(counts.MANUFACTURER).toBeGreaterThan(0);
    const names = buildSupplierBench([]).filter((e) => e.tier === "MANUFACTURER").map((e) => e.title);
    expect(names.some((name) => /indio/i.test(name))).toBe(true);
  });

  it("reads a tier from the supplier's own words first", () => {
    const supplier = BOTANICA_SUPPLIERS.find((s) => /indio/i.test(s.name))!;
    expect(tierOfRegistrySupplier(supplier)).toBe("MANUFACTURER");
  });

  it("falls back to the curated fields when the words say nothing", () => {
    expect(tierOfRegistrySupplier({
      name: "Casa Ejemplo", strengths: ["buen surtido"], categories: ["velas"],
      sourcingPolicy: "CUSTOM_MANUFACTURING", wholesale: false,
    } as never)).toBe("MANUFACTURER");

    expect(tierOfRegistrySupplier({
      name: "Casa Ejemplo", strengths: ["buen surtido"], categories: ["velas"],
      sourcingPolicy: "CONSUMABLES", wholesale: true,
    } as never)).toBe("WHOLESALER");

    expect(tierOfRegistrySupplier({
      name: "Casa Ejemplo", strengths: ["tienda"], categories: ["velas"],
      sourcingPolicy: "CONSUMABLES", wholesale: false,
    } as never)).toBe("UNKNOWN");
  });
});

describe("joining the two benches", () => {
  it("keeps the researched record when both know the same host", () => {
    const registryHost = registryBench()[0].host;
    const bench = buildSupplierBench([{ host: registryHost, title: "Snippet title", tier: "RESELLER", score: 5 }]);
    const entry = bench.find((e) => e.host === registryHost)!;
    expect(entry.source).toBe("registry");
    expect(entry.title).not.toBe("Snippet title");
    expect(bench.filter((e) => e.host === registryHost)).toHaveLength(1);
  });

  it("keeps a web candidate the registry has never seen", () => {
    const bench = buildSupplierBench([{ host: "nuevo-proveedor.example", title: "Nuevo", tier: "WHOLESALER", score: 70 }]);
    const entry = bench.find((e) => e.host === "nuevo-proveedor.example")!;
    expect(entry.source).toBe("web");
    expect(bench.length).toBe(BOTANICA_SUPPLIERS.length + 1);
  });

  it("normalizes www and ignores an empty host", () => {
    expect(hostOfUrl("https://WWW.Example.com/path")).toBe("example.com");
    expect(buildSupplierBench([{ host: "" }]).length).toBe(BOTANICA_SUPPLIERS.length);
  });

  it("ranks manufacturers first and unclassified last", () => {
    const tiers = buildSupplierBench([]).map((e) => e.tier);
    expect(tiers[0]).toBe("MANUFACTURER");
    expect(tiers[tiers.length - 1]).toBe("UNKNOWN");
  });

  it("counts every entry exactly once", () => {
    const bench = buildSupplierBench([]);
    const counts = benchCountsByTier(bench);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(bench.length);
  });
});
