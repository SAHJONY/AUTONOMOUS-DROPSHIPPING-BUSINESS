import { describe, expect, it } from "vitest";
import { recipeEconomics } from "../lib/factory-economics";
import type { FactoryMaterial, FactoryRecipe } from "../lib/botanica-factory";

const material = { id: "m1", unitCost: 0.1 } as FactoryMaterial;
const recipe = {
  lines: [{ materialId: "m1", quantity: 20, wastePercent: 5 }], laborMinutes: 12, laborRateHourly: 15,
  packagingCost: 0.5, labelCost: 0.1, overheadCost: 0.3, retailPrice: 14.99,
} as FactoryRecipe;

describe("factory unit economics", () => {
  it("includes materials, waste, labor, packaging, label and overhead", () => {
    expect(recipeEconomics(recipe, [material])).toEqual({ materialCost: 2.1, laborCost: 3, unitCost: 6, grossProfit: 8.99, grossMargin: 59.97 });
  });
  it("does not invent cost for a missing material", () => { expect(recipeEconomics(recipe, []).unitCost).toBe(3.9); });
});
