import { evaluateBotanicaSupplierOpportunity } from "./botanica-council";
import { evaluateProductOpportunity, type ProductOpportunityInput } from "./botanica-product-opportunity";
import type { SupplierQuote } from "./botanica-supplier-quotes";
import type { BotanicaSkuCandidate } from "./botanica-first-25-sku-candidates";

export type BotanicaCommerceStage =
  | "HOLD"
  | "COUNCIL_APPROVED"
  | "OWNER_APPROVED_FOR_DRAFT";

export type BotanicaCommercePipelineInput = {
  candidate: BotanicaSkuCandidate;
  quote: SupplierQuote;
  demandScore?: number;
  catalogGapScore?: number;
  supplierReliabilityScore?: number;
  provenanceScore?: number;
  ownerCatalogApproved?: boolean;
};

export type BotanicaCommercePipelineResult = {
  sku: string;
  stage: BotanicaCommerceStage;
  canCreateShopifyDraft: boolean;
  canPublishShopify: false;
  canCommitPurchase: false;
  opportunity: ReturnType<typeof evaluateProductOpportunity>;
  council: ReturnType<typeof evaluateBotanicaSupplierOpportunity>;
  reasons: string[];
};

/**
 * Fail-closed commercial gate for BOTANICA OCHOSI.
 *
 * This pipeline can only authorize creation of a Shopify DRAFT. It never authorizes
 * active publishing or a supplier purchase. Those remain separate owner decisions.
 */
export function evaluateBotanicaCommercePipeline(
  input: BotanicaCommercePipelineInput,
  options: { now?: Date; minimumMarginPct?: number } = {},
): BotanicaCommercePipelineResult {
  const opportunityInput: ProductOpportunityInput = {
    id: `commerce:${input.candidate.sku}:${input.quote.id}`,
    productName: input.candidate.title,
    quote: input.quote,
    demandScore: input.demandScore,
    catalogGapScore: input.catalogGapScore,
    supplierReliabilityScore: input.supplierReliabilityScore,
    provenanceScore: input.provenanceScore,
  };

  const opportunity = evaluateProductOpportunity(opportunityInput, options);
  const council = evaluateBotanicaSupplierOpportunity(opportunity);
  const reasons = [...new Set([...opportunity.hardGateReasons, ...council.reasons])];

  let stage: BotanicaCommerceStage = "HOLD";
  if (opportunity.eligibleForCouncil && council.verdict === "APPROVE") {
    stage = "COUNCIL_APPROVED";
  }
  if (stage === "COUNCIL_APPROVED" && input.ownerCatalogApproved === true) {
    stage = "OWNER_APPROVED_FOR_DRAFT";
  }

  if (stage !== "OWNER_APPROVED_FOR_DRAFT" && input.ownerCatalogApproved === true) {
    reasons.push("Owner catalog approval cannot override Supplier Intelligence or Council hard gates.");
  }
  if (stage === "COUNCIL_APPROVED" && input.ownerCatalogApproved !== true) {
    reasons.push("Owner catalog approval is required before creating a Shopify draft.");
  }

  return {
    sku: input.candidate.sku,
    stage,
    canCreateShopifyDraft: stage === "OWNER_APPROVED_FOR_DRAFT",
    canPublishShopify: false,
    canCommitPurchase: false,
    opportunity,
    council,
    reasons: [...new Set(reasons)],
  };
}
