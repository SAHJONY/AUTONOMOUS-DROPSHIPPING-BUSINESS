import { describe, expect, it } from "vitest";
import { BOTANICA_MASTER_CATALOG } from "../lib/botanica/master-catalog";
import {
  SUPPLIER_CANDIDATES,
  createCandidateSku,
  getCandidateSkuPipeline,
  scoreSupplierForFamily,
} from "../lib/botanica/supplier-match";
import { evaluateBotanicaSku } from "../lib/botanica/catalog-service";

describe("BOTANICA supplier candidate pipeline", () => {
  it("keeps all seeded supplier candidates unverified until evidence exists", () => {
    expect(SUPPLIER_CANDIDATES.length).toBeGreaterThanOrEqual(5);
    expect(SUPPLIER_CANDIDATES.every((supplier) => supplier.verification_status === "PENDING")).toBe(true);
    expect(SUPPLIER_CANDIDATES.every((supplier) => supplier.reseller_terms_verified === false)).toBe(true);
  });

  it("gives the USA/local candidate a positive physical-product match score", () => {
    const family = BOTANICA_MASTER_CATALOG.find((item) => item.id === "candle-plain");
    const supplier = SUPPLIER_CANDIDATES.find((item) => item.id === "monzon-botanica");
    expect(family).toBeTruthy();
    expect(supplier).toBeTruthy();
    expect(scoreSupplierForFamily(supplier!, family!)).toBeGreaterThan(0);
  });

  it("creates candidate SKUs on HOLD with missing-evidence gates", () => {
    const family = BOTANICA_MASTER_CATALOG.find((item) => item.id === "candle-plain")!;
    const supplier = SUPPLIER_CANDIDATES.find((item) => item.id === "monzon-botanica")!;
    const candidate = createCandidateSku(family, supplier);
    const evaluation = evaluateBotanicaSku(candidate);

    expect(candidate.publish_status).toBe("HOLD");
    expect(evaluation.draft_ready).toBe(false);
    expect(evaluation.live_ready).toBe(false);
    expect(evaluation.failures).toContain("SUPPLIER_VERIFIED");
    expect(evaluation.failures).toContain("CULTURAL_VERIFIED");
    expect(evaluation.failures).toContain("COMMERCE_SAFE");
    expect(evaluation.failures).toContain("IMAGE_RIGHTS_VERIFIED");
    expect(evaluation.failures).toContain("SOURCE_EVIDENCE");
    expect(evaluation.failures).toContain("VERIFIED_PRICE");
    expect(evaluation.failures).toContain("INVENTORY_AVAILABLE");
  });

  it("produces no draft-ready candidate from the unverified seed registry", () => {
    const pipeline = getCandidateSkuPipeline(3);
    expect(pipeline.length).toBeGreaterThan(0);
    expect(pipeline.some((candidate) => candidate.evaluation.draft_ready)).toBe(false);
    expect(pipeline.some((candidate) => candidate.evaluation.live_ready)).toBe(false);
  });
});
