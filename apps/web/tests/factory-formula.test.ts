import { describe, expect, it } from "vitest";
import { addFactoryMaterial, addFactoryRecipe, getFactory } from "../lib/botanica-factory";

describe("factory master formulas", () => {
  it("stores multiple components and complete manufacturing instructions", async () => {
    const orgId = `factory-formula-${crypto.randomUUID()}`;
    const beads = await addFactoryMaterial(orgId, { name: "Blue beads", sku: "MAT-BLUE", unit: "piece", unitCost: 0.05, quantityOnHand: 100 });
    const cord = await addFactoryMaterial(orgId, { name: "Cord", sku: "MAT-CORD", unit: "ft", unitCost: 0.2, quantityOnHand: 20 });
    const recipe = await addFactoryRecipe(orgId, {
      name: "Ochosi bracelet", sku: "BO-OCH-01", retailPrice: 14.99, batchYield: 5,
      lines: [{ materialId: beads.id, quantity: 12, wastePercent: 2 }, { materialId: cord.id, quantity: 1, wastePercent: 5 }],
      tools: ["Clean tray", "Scissors"], manufacturingSteps: ["Count components", "Assemble and inspect"],
      safetyInstructions: ["Use approved materials"], cleaningInstructions: ["Clean the work surface"],
      storageInstructions: "Store sealed and identified by lot.", qcChecklist: ["Count verified"],
    });
    const saved = await getFactory(orgId);
    expect(recipe.lines).toHaveLength(2);
    expect(saved.recipes[0]).toMatchObject({ batchYield: 5, tools: ["Clean tray", "Scissors"], manufacturingSteps: ["Count components", "Assemble and inspect"] });
  });
});
