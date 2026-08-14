import { kv } from "./kv";

export type FactoryRisk = "LOW" | "REVIEW_REQUIRED" | "BLOCKED_AT_HOME";
export type ProductionStatus = "PLANNED" | "IN_PROGRESS" | "QC_HOLD" | "RELEASED" | "REJECTED";

export interface FactoryMaterial {
  id: string;
  orgId: string;
  sku: string;
  name: string;
  supplier: string;
  supplierSku: string;
  countryOfOrigin: string;
  unit: string;
  unitCost: number;
  quantityOnHand: number;
  reorderPoint: number;
  lotCode: string;
  expiresAt: string;
  createdAt: string;
}

export interface FactoryBomLine {
  materialId: string;
  quantity: number;
  wastePercent: number;
}

export interface FactoryRecipe {
  id: string;
  orgId: string;
  sku: string;
  name: string;
  category: string;
  version: number;
  risk: FactoryRisk;
  retailPrice: number;
  laborMinutes: number;
  laborRateHourly: number;
  packagingCost: number;
  labelCost: number;
  overheadCost: number;
  batchYield: number;
  tools: string[];
  manufacturingSteps: string[];
  safetyInstructions: string[];
  cleaningInstructions: string[];
  storageInstructions: string;
  qcChecklist: string[];
  labelStatement: string;
  lines: FactoryBomLine[];
  active: boolean;
  createdAt: string;
}

export interface ProductionOrder {
  id: string;
  orgId: string;
  lotCode: string;
  recipeId: string;
  quantityPlanned: number;
  quantityProduced: number;
  quantityRejected: number;
  status: ProductionStatus;
  operator: string;
  qcApprovedBy: string;
  notes: string;
  createdAt: string;
  releasedAt: string;
}

export interface FactorySnapshot {
  materials: FactoryMaterial[];
  recipes: FactoryRecipe[];
  orders: ProductionOrder[];
}

const key = (orgId: string) => `factory:${orgId}`;
const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

export async function getFactory(orgId: string): Promise<FactorySnapshot> {
  const snapshot = (await kv.get<FactorySnapshot>(key(orgId))) ?? { materials: [], recipes: [], orders: [] };
  snapshot.recipes = snapshot.recipes.map((recipe) => ({
    ...recipe,
    batchYield: recipe.batchYield ?? 1,
    tools: recipe.tools ?? [],
    manufacturingSteps: recipe.manufacturingSteps ?? [],
    safetyInstructions: recipe.safetyInstructions ?? [],
    cleaningInstructions: recipe.cleaningInstructions ?? [],
    storageInstructions: recipe.storageInstructions ?? "Almacenar limpio, seco, cerrado y separado de materiales rechazados.",
  }));
  return snapshot;
}

async function saveFactory(orgId: string, snapshot: FactorySnapshot) {
  await kv.set(key(orgId), snapshot);
  return snapshot;
}

export async function addFactoryMaterial(orgId: string, input: Record<string, unknown>) {
  const snapshot = await getFactory(orgId);
  const name = String(input.name ?? "").trim();
  const sku = String(input.sku ?? "").trim().toUpperCase();
  if (!name || !sku) throw new Error("Material name and SKU are required.");
  if (snapshot.materials.some((item) => item.sku === sku)) throw new Error("Material SKU already exists.");
  const material: FactoryMaterial = {
    id: crypto.randomUUID(), orgId, name, sku,
    supplier: String(input.supplier ?? "").trim(), supplierSku: String(input.supplierSku ?? "").trim(),
    countryOfOrigin: String(input.countryOfOrigin ?? "").trim(), unit: String(input.unit ?? "unit").trim() || "unit",
    unitCost: safeNumber(input.unitCost), quantityOnHand: safeNumber(input.quantityOnHand), reorderPoint: safeNumber(input.reorderPoint),
    lotCode: String(input.lotCode ?? "").trim(), expiresAt: String(input.expiresAt ?? "").trim(), createdAt: new Date().toISOString(),
  };
  snapshot.materials.unshift(material);
  await saveFactory(orgId, snapshot);
  return material;
}

export async function addFactoryRecipe(orgId: string, input: Record<string, unknown>) {
  const snapshot = await getFactory(orgId);
  const name = String(input.name ?? "").trim();
  const sku = String(input.sku ?? "").trim().toUpperCase();
  if (!name || !sku) throw new Error("Product name and SKU are required.");
  if (snapshot.recipes.some((item) => item.sku === sku && item.active)) throw new Error("An active product with this SKU already exists.");
  const requestedLines = Array.isArray(input.lines) ? input.lines : [];
  const lines: FactoryBomLine[] = requestedLines.map((line) => {
    const row = line as Record<string, unknown>;
    return { materialId: String(row.materialId ?? ""), quantity: safeNumber(row.quantity), wastePercent: safeNumber(row.wastePercent) };
  }).filter((line) => snapshot.materials.some((item) => item.id === line.materialId) && line.quantity > 0);
  if (!lines.length) throw new Error("At least one valid BOM component is required.");
  const risk = String(input.risk ?? "LOW") as FactoryRisk;
  if (!["LOW", "REVIEW_REQUIRED", "BLOCKED_AT_HOME"].includes(risk)) throw new Error("Invalid regulatory risk classification.");
  const recipe: FactoryRecipe = {
    id: crypto.randomUUID(), orgId, name, sku, category: String(input.category ?? "KITS").trim(), version: 1, risk,
    retailPrice: safeNumber(input.retailPrice), laborMinutes: safeNumber(input.laborMinutes), laborRateHourly: safeNumber(input.laborRateHourly, 15),
    packagingCost: safeNumber(input.packagingCost), labelCost: safeNumber(input.labelCost), overheadCost: safeNumber(input.overheadCost),
    batchYield: Math.max(1, Math.floor(safeNumber(input.batchYield, 1))),
    tools: textLines(input.tools),
    manufacturingSteps: textLines(input.manufacturingSteps),
    safetyInstructions: textLines(input.safetyInstructions),
    cleaningInstructions: textLines(input.cleaningInstructions),
    storageInstructions: String(input.storageInstructions ?? "Almacenar limpio, seco, cerrado y separado de materiales rechazados.").trim(),
    qcChecklist: Array.isArray(input.qcChecklist) ? input.qcChecklist.map(String).map((v) => v.trim()).filter(Boolean) : [],
    labelStatement: String(input.labelStatement ?? "No consagrado / no preparado ceremonialmente.").trim(), lines, active: true, createdAt: new Date().toISOString(),
  };
  snapshot.recipes.unshift(recipe);
  await saveFactory(orgId, snapshot);
  return recipe;
}

function textLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((line) => line.trim()).filter(Boolean);
  return String(value ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
}

export async function createProductionOrder(orgId: string, input: Record<string, unknown>) {
  const snapshot = await getFactory(orgId);
  const recipe = snapshot.recipes.find((item) => item.id === String(input.recipeId ?? "") && item.active);
  if (!recipe) throw new Error("Active factory product not found.");
  if (recipe.risk !== "LOW") throw new Error("This product requires compliance review before production.");
  const quantityPlanned = Math.floor(safeNumber(input.quantityPlanned));
  if (quantityPlanned < 1) throw new Error("Production quantity must be at least one.");
  for (const line of recipe.lines) {
    const material = snapshot.materials.find((item) => item.id === line.materialId);
    const required = line.quantity * quantityPlanned * (1 + line.wastePercent / 100);
    if (!material || material.quantityOnHand < required) throw new Error(`Insufficient material: ${material?.name ?? line.materialId}.`);
  }
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const sequence = snapshot.orders.filter((item) => item.lotCode.includes(date)).length + 1;
  const order: ProductionOrder = {
    id: crypto.randomUUID(), orgId, lotCode: `BO-${recipe.sku}-${date}-${String(sequence).padStart(3, "0")}`,
    recipeId: recipe.id, quantityPlanned, quantityProduced: 0, quantityRejected: 0, status: "PLANNED",
    operator: String(input.operator ?? "").trim(), qcApprovedBy: "", notes: String(input.notes ?? "").trim(), createdAt: new Date().toISOString(), releasedAt: "",
  };
  snapshot.orders.unshift(order);
  await saveFactory(orgId, snapshot);
  return order;
}

export async function releaseProductionOrder(orgId: string, input: Record<string, unknown>) {
  const snapshot = await getFactory(orgId);
  const order = snapshot.orders.find((item) => item.id === String(input.orderId ?? ""));
  if (!order) throw new Error("Production order not found.");
  if (order.status === "RELEASED") throw new Error("This lot is already released.");
  const recipe = snapshot.recipes.find((item) => item.id === order.recipeId);
  if (!recipe) throw new Error("Factory product not found.");
  const produced = Math.floor(safeNumber(input.quantityProduced));
  const rejected = Math.floor(safeNumber(input.quantityRejected));
  if (produced < 1 || produced + rejected > order.quantityPlanned) throw new Error("Produced and rejected quantities do not match the planned lot.");
  const qcApprovedBy = String(input.qcApprovedBy ?? "").trim();
  if (!qcApprovedBy) throw new Error("QC approver is required before release.");
  for (const line of recipe.lines) {
    const material = snapshot.materials.find((item) => item.id === line.materialId);
    if (material) material.quantityOnHand = Math.max(0, material.quantityOnHand - line.quantity * (produced + rejected) * (1 + line.wastePercent / 100));
  }
  Object.assign(order, { quantityProduced: produced, quantityRejected: rejected, qcApprovedBy, status: "RELEASED" as const, releasedAt: new Date().toISOString(), notes: String(input.notes ?? order.notes).trim() });
  await saveFactory(orgId, snapshot);
  return order;
}
