import { BOTANICA_FIRST_25_SKU_CANDIDATES } from "./botanica-first-25-sku-candidates";

export type BotanicaSourcingPriority = "P1" | "P2" | "P3";

export interface BotanicaSourcingAction {
  sku: string;
  priority: BotanicaSourcingPriority;
  rationale: string;
  missingEvidence: string[];
  nextAction: string;
}

const P1 = new Set([
  "BO-NG-OPON-IFE-LG",
  "BO-NG-OPON-ASSORTED",
  "BO-NG-IYEROSUN",
  "BO-NG-OPON-WHOLESALE",
  "BO-LC-COLLAR-YEMAYA",
  "BO-LC-ILDE-OYA",
  "BO-LC-SOPERA-OSHUN",
  "BO-LC-SOPERA-YEMAYA",
  "BO-BC-VELAS-7D",
  "BO-BC-ACEITES",
  "BO-BC-BANOS",
  "BO-BC-JABONES",
  "BO-BC-INCIENSOS",
  "BO-BC-COLONIAS",
  "BO-BC-ESENCIAS",
]);

const P3 = new Set([
  "BO-NG-OROGBO",
  "BO-NG-OBI-ABATA",
  "BO-NG-EWE-HERBS",
  "BO-NG-EDUN-ARA",
  "BO-NG-ESU-AJE",
]);

function priorityForSku(sku: string): BotanicaSourcingPriority {
  if (P1.has(sku)) return "P1";
  if (P3.has(sku)) return "P3";
  return "P2";
}

function missingEvidenceFor(candidate: (typeof BOTANICA_FIRST_25_SKU_CANDIDATES)[number]): string[] {
  const missing = [
    "wholesale_cost",
    "moq_or_case_pack",
    "inventory_or_availability",
    "shipping_terms",
    "lead_time",
    "authorized_product_images",
  ];

  if (!candidate.landedCostVerified) missing.push("landed_cost");
  if (candidate.lane !== "BOTANICA_CONSUMABLES") {
    missing.push("provenance_and_tradition_mapping");
  }
  if (["BO-NG-OROGBO", "BO-NG-OBI-ABATA", "BO-NG-EWE-HERBS"].includes(candidate.sku)) {
    missing.push("agricultural_or_perishable_compliance");
  }

  return missing;
}

function rationaleFor(candidate: (typeof BOTANICA_FIRST_25_SKU_CANDIDATES)[number]): string {
  const priority = priorityForSku(candidate.sku);
  if (priority === "P1") {
    return "Strong initial-commercial candidate: supplier evidence is public/wholesale-oriented and the item/category fits the first BOTANICA assortment. Quote and stock data are the primary blockers.";
  }
  if (priority === "P3") {
    return "Commercially interesting but requires additional provenance, cultural, agricultural, perishability, or listing-language review before economics alone can justify activation.";
  }
  return "Valid assortment candidate, but exact variant/SKU definition and supplier economics should be completed after the P1 basket.";
}

function nextActionFor(candidate: (typeof BOTANICA_FIRST_25_SKU_CANDIDATES)[number]): string {
  const priority = priorityForSku(candidate.sku);
  if (priority === "P1") {
    return `Request or retrieve current B2B price, MOQ/case pack, stock, shipping, lead time, and image permission from ${candidate.supplier}; then calculate landed cost and send to Council.`;
  }
  if (priority === "P3") {
    return `Complete compliance/provenance review for ${candidate.title} before requesting activation; keep Shopify status HOLD even if economics look attractive.`;
  }
  return `Obtain exact variant-level catalog data from ${candidate.supplier}, then promote to P1 only if the SKU is clearly defined and commercially viable.`;
}

export const BOTANICA_FIRST_25_SOURCING_MATRIX: BotanicaSourcingAction[] =
  BOTANICA_FIRST_25_SKU_CANDIDATES.map((candidate) => ({
    sku: candidate.sku,
    priority: priorityForSku(candidate.sku),
    rationale: rationaleFor(candidate),
    missingEvidence: missingEvidenceFor(candidate),
    nextAction: nextActionFor(candidate),
  }));

export function getBotanicaFirst25SourcingMatrix() {
  return BOTANICA_FIRST_25_SOURCING_MATRIX.map((row) => ({
    ...row,
    missingEvidence: [...row.missingEvidence],
  }));
}

export function getBotanicaP1SkuCandidates() {
  const p1 = new Set(
    BOTANICA_FIRST_25_SOURCING_MATRIX.filter((row) => row.priority === "P1").map((row) => row.sku),
  );
  return BOTANICA_FIRST_25_SKU_CANDIDATES.filter((candidate) => p1.has(candidate.sku)).map((candidate) => ({ ...candidate }));
}
