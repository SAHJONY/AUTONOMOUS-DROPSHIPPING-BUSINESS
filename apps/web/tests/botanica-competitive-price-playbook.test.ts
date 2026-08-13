import { describe, expect, it } from "vitest";
import {
  BOTANICA_COMPETITIVE_PRICE_PLAYBOOK,
  BOTANICA_QUANTITY_TIERS,
  grossMarginPercent,
  priceAtDiscount,
  priceClearsMarginFloor,
} from "../lib/botanica-competitive-price-playbook";

describe("botanica competitive price playbook", () => {
  it("keeps every public recommendation sourced and positive", () => {
    expect(BOTANICA_COMPETITIVE_PRICE_PLAYBOOK.length).toBeGreaterThan(10);
    for (const row of BOTANICA_COMPETITIVE_PRICE_PLAYBOOK) {
      expect(row.currentPriceUsd).toBeGreaterThan(0);
      expect(row.sourceUrl.startsWith("https://")).toBe(true);
      if (row.targetRetailPriceUsd !== null) expect(row.targetRetailPriceUsd).toBeGreaterThan(0);
    }
  });

  it("calculates the proposed candle quantity tiers", () => {
    expect(BOTANICA_QUANTITY_TIERS.map(tier => priceAtDiscount(7.49, tier.discountPercent)))
      .toEqual([7.49, 6.74, 5.99, 5.24]);
  });

  it("fails closed when the 35 percent margin floor is not met", () => {
    expect(grossMarginPercent(7.49, 4)).toBe(46.6);
    expect(priceClearsMarginFloor(7.49, 4)).toBe(true);
    expect(priceClearsMarginFloor(7.49, 5)).toBe(false);
  });
});
