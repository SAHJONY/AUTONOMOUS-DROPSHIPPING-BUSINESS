import type { FactoryMaterial, FactoryRecipe } from "./botanica-factory";

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function recipeEconomics(recipe: FactoryRecipe, materials: FactoryMaterial[]) {
  const materialCost = recipe.lines.reduce((total, line) => {
    const material = materials.find((item) => item.id === line.materialId);
    return material ? total + material.unitCost * line.quantity * (1 + line.wastePercent / 100) : total;
  }, 0);
  const laborCost = (recipe.laborMinutes / 60) * recipe.laborRateHourly;
  const unitCost = roundMoney(materialCost + laborCost + recipe.packagingCost + recipe.labelCost + recipe.overheadCost);
  const grossProfit = roundMoney(recipe.retailPrice - unitCost);
  const grossMargin = recipe.retailPrice > 0 ? roundMoney((grossProfit / recipe.retailPrice) * 100) : 0;
  return { materialCost: roundMoney(materialCost), laborCost: roundMoney(laborCost), unitCost, grossProfit, grossMargin };
}
