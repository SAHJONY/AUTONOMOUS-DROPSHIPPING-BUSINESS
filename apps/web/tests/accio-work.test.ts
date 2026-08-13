import { describe, expect, it } from "vitest";
import { buildAccioSourcingBrief } from "../lib/accio-work";

describe("Accio Work sourcing bridge", () => {
  it("builds an evidence-first, transaction-free Botanica brief", () => {
    const brief = buildAccioSourcingBrief({
      query: "Lucumi eleke necklace wholesale",
      targetRetailUsd: 36,
      maximumMoq: 6,
    });
    expect(brief.execution_mode).toBe("external_research_only");
    expect(brief.prompt).toContain("landed unit cost at or below USD 12.00");
    expect(brief.prompt).toMatch(/Do not contact suppliers or execute transactions/i);
    expect(brief.prohibited_actions).toContain("placing or confirming an order");
  });

  it("blocks unrelated generic sourcing", () => {
    expect(() => buildAccioSourcingBrief({ query: "viral bluetooth gadget" })).toThrow(
      /fail-closed/i,
    );
  });

  it("does not let a zero or invalid MOQ weaken the one-unit floor", () => {
    const brief = buildAccioSourcingBrief({ query: "Orisha devotional candle", maximumMoq: 0 });
    expect(brief.prompt).toContain("Maximum acceptable MOQ: 1");
  });
});
