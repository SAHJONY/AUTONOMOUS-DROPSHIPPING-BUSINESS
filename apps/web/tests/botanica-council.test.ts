import { describe, expect, it } from "vitest";
import { evaluateBotanicaProduct } from "../lib/botanica-council";
import type { Product } from "../lib/types";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    org_id: "o1",
    title: "Ochosi Orisha devotional candle",
    description: "Religious supply for a BOTANICA OCHOSI catalog.",
    source: "CJ Dropshipping",
    supplier_url: "https://supplier.example/item",
    cost: 4,
    price: 14.99,
    status: "ready_to_launch",
    created_at: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("BOTANICA OCHOSI council", () => {
  it("approves a relevant, evidenced product with healthy margin", () => {
    const result = evaluateBotanicaProduct(product());
    expect(result.verdict).toBe("APPROVE");
    expect(result.checks.botanica_relevance).toBe(true);
    expect(result.checks.margin_floor).toBe(true);
  });

  it("rejects unrelated generic dropshipping merchandise", () => {
    const result = evaluateBotanicaProduct(
      product({
        title: "Smart interactive dog ball",
        description: "USB rechargeable pet toy",
      }),
    );
    expect(result.verdict).toBe("REJECT");
    expect(result.checks.botanica_relevance).toBe(false);
  });

  it("holds products without supplier evidence", () => {
    const result = evaluateBotanicaProduct(
      product({ source: "agent", supplier_url: "", supplier: undefined, supplier_pid: undefined }),
    );
    expect(result.verdict).toBe("HOLD");
    expect(result.checks.supplier_evidence).toBe(false);
  });

  it("holds low-margin products", () => {
    const result = evaluateBotanicaProduct(product({ cost: 9, price: 10 }));
    expect(result.verdict).toBe("HOLD");
    expect(result.checks.margin_floor).toBe(false);
  });

  it("rejects guaranteed outcome or medical cure claims", () => {
    const result = evaluateBotanicaProduct(
      product({ description: "BOTANICA religious supply — 100% guaranteed to cure disease." }),
    );
    expect(result.verdict).toBe("REJECT");
    expect(result.checks.prohibited_claims).toBe(true);
  });
});
