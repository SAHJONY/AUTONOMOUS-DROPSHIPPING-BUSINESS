import { botanicaRelevantText } from "./botanica-policy";
import type { ProductOpportunityResult } from "./botanica-product-opportunity";
import { listProducts, remember, updateProduct } from "./store";
import type { Product } from "./types";

export type CouncilVerdict = "APPROVE" | "HOLD" | "REJECT";

export interface CouncilDecision {
  product_id: string;
  title: string;
  verdict: CouncilVerdict;
  confidence: number;
  checks: {
    botanica_relevance: boolean;
    supplier_evidence: boolean;
    positive_cost: boolean;
    positive_price: boolean;
    margin_floor: boolean;
    prohibited_claims: boolean;
  };
  gross_margin_pct: number | null;
  reasons: string[];
}

export interface SupplierOpportunityCouncilDecision {
  opportunity_id: string;
  product_name: string;
  verdict: CouncilVerdict;
  confidence: number;
  opportunity_score: number;
  opportunity_tier: ProductOpportunityResult["tier"];
  gross_margin_pct: number | null;
  reasons: string[];
}

const PROHIBITED_CLAIMS = [
  /guarantee(?:d|s)?\s+(?:love|money|luck|healing|cure|success)/i,
  /cure(?:s|d)?\s+(?:disease|illness|cancer|diabetes|depression|anxiety)/i,
  /100%\s+guaranteed/i,
];

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasSupplierEvidence(product: Product): boolean {
  return Boolean(
    product.supplier_url ||
      product.supplier_pid ||
      product.supplier_vid ||
      product.supplier ||
      (product.source && product.source !== "agent"),
  );
}

export function evaluateBotanicaProduct(product: Product): CouncilDecision {
  const text = `${product.title ?? ""} ${product.description ?? ""}`;
  const botanica = botanicaRelevantText(text);
  const supplierEvidence = hasSupplierEvidence(product);
  const cost = Number(product.cost ?? 0);
  const price = Number(product.price ?? 0);
  const positiveCost = Number.isFinite(cost) && cost > 0;
  const positivePrice = Number.isFinite(price) && price > 0;
  const margin = positiveCost && positivePrice ? (price - cost) / price : null;
  const marginFloor = margin !== null && margin >= 0.35;
  const prohibitedClaims = PROHIBITED_CLAIMS.some((pattern) => pattern.test(text));

  const reasons: string[] = [];
  if (!botanica) reasons.push("Product is not explicitly relevant to BOTANICA OCHOSI.");
  if (!supplierEvidence) reasons.push("No supplier/source evidence is attached.");
  if (!positiveCost) reasons.push("Cost is missing or non-positive.");
  if (!positivePrice) reasons.push("Retail price is missing or non-positive.");
  if (positiveCost && positivePrice && !marginFloor) reasons.push("Gross margin is below the 35% floor.");
  if (prohibitedClaims) reasons.push("Listing contains an impermissible guarantee or health claim.");

  let verdict: CouncilVerdict = "APPROVE";
  if (!botanica || prohibitedClaims) verdict = "REJECT";
  else if (!supplierEvidence || !positiveCost || !positivePrice || !marginFloor) verdict = "HOLD";

  let confidence = 45;
  confidence += botanica ? 15 : -25;
  confidence += supplierEvidence ? 10 : -10;
  confidence += positiveCost ? 8 : -8;
  confidence += positivePrice ? 8 : -8;
  confidence += marginFloor ? 10 : -10;
  confidence += prohibitedClaims ? -30 : 4;

  return {
    product_id: product.id,
    title: product.title,
    verdict,
    confidence: clampConfidence(confidence),
    checks: {
      botanica_relevance: botanica,
      supplier_evidence: supplierEvidence,
      positive_cost: positiveCost,
      positive_price: positivePrice,
      margin_floor: marginFloor,
      prohibited_claims: prohibitedClaims,
    },
    gross_margin_pct: margin === null ? null : Math.round(margin * 1000) / 10,
    reasons,
  };
}

/**
 * Supplier/Product Opportunity Council adapter.
 * A numeric opportunity score can improve ranking and confidence, but cannot override
 * the quote/provenance/export/cultural hard gates enforced upstream.
 */
export function evaluateBotanicaSupplierOpportunity(
  opportunity: ProductOpportunityResult,
): SupplierOpportunityCouncilDecision {
  const reasons = [...opportunity.hardGateReasons];
  let verdict: CouncilVerdict = opportunity.eligibleForCouncil ? "APPROVE" : "HOLD";

  // Extremely weak economics/evidence remain a hold even if upstream inputs were malformed.
  if (opportunity.components.economics < 70) {
    verdict = "HOLD";
    reasons.push("Opportunity economics do not meet the BOTANICA margin threshold.");
  }
  if (opportunity.components.evidence < 60) {
    verdict = "HOLD";
    reasons.push("Supplier evidence quality is below the Council threshold.");
  }

  const confidence = clampConfidence(
    opportunity.score * 0.7 +
      opportunity.components.evidence * 0.15 +
      opportunity.components.provenance * 0.15,
  );

  return {
    opportunity_id: opportunity.id,
    product_name: opportunity.productName,
    verdict,
    confidence,
    opportunity_score: opportunity.score,
    opportunity_tier: opportunity.tier,
    gross_margin_pct: opportunity.quoteEvaluation.grossMarginPct,
    reasons,
  };
}

/**
 * Council gate for launch candidates. The gate is deterministic and auditable:
 * LLMs may recommend products, but cannot override relevance, evidence, margin,
 * or prohibited-claim checks. Non-approved launch candidates are moved back to
 * `analyzed`, never deleted.
 */
export async function runBotanicaCatalogCouncil(orgId: string): Promise<{
  reviewed: number;
  approved: number;
  held: number;
  rejected: number;
  decisions: CouncilDecision[];
}> {
  const products = await listProducts(orgId);
  const candidates = products.filter((product) => product.status === "ready_to_launch");
  const decisions: CouncilDecision[] = [];

  for (const product of candidates) {
    const decision = evaluateBotanicaProduct(product);
    decisions.push(decision);
    if (decision.verdict !== "APPROVE") {
      await updateProduct(orgId, product.id, { status: "analyzed" });
    }
  }

  const approved = decisions.filter((d) => d.verdict === "APPROVE").length;
  const held = decisions.filter((d) => d.verdict === "HOLD").length;
  const rejected = decisions.filter((d) => d.verdict === "REJECT").length;

  if (decisions.length) {
    await remember(
      orgId,
      "botanica-council:last-catalog-review",
      JSON.stringify({ reviewed: decisions.length, approved, held, rejected, decisions }),
      "botanica_council",
    );
  }

  return { reviewed: decisions.length, approved, held, rejected, decisions };
}
