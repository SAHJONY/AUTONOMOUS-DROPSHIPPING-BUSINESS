import { evaluateSupplierQuote, type QuoteEvaluation, type SupplierQuote } from "./botanica-supplier-quotes";

export type ProductOpportunityInput = {
  id: string;
  productName: string;
  quote: SupplierQuote;
  demandScore?: number; // 0-100, optional external signal (e.g. Last30Days)
  catalogGapScore?: number; // 0-100, how much this fills a missing category/assortment need
  supplierReliabilityScore?: number; // 0-100, evidence-backed only
  provenanceScore?: number; // 0-100, source/maker/origin documentation quality
};

export type ProductOpportunityResult = {
  id: string;
  productName: string;
  score: number;
  tier: "A" | "B" | "C" | "HOLD";
  eligibleForCouncil: boolean;
  hardGateReasons: string[];
  quoteEvaluation: QuoteEvaluation;
  components: {
    economics: number;
    evidence: number;
    provenance: number;
    supplierReliability: number;
    demand: number;
    catalogGap: number;
  };
};

function clampScore(value: number | undefined, fallback = 0) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}

function economicsScore(evaluation: QuoteEvaluation) {
  const margin = evaluation.grossMarginPct;
  if (margin === null) return 0;
  if (margin >= 65) return 100;
  if (margin >= 55) return 90;
  if (margin >= 45) return 80;
  if (margin >= 35) return 70;
  if (margin >= 25) return 45;
  return 20;
}

function evidenceScore(quote: SupplierQuote, evaluation: QuoteEvaluation) {
  if (!quote.evidence.length) return 0;
  if (!evaluation.evidenceFresh) return 25;

  const strongestType = quote.evidence.reduce((best, item) => {
    const rank = {
      PUBLIC_PRICE: 1,
      WRITTEN_QUOTE: 2,
      WHOLESALE_CATALOG: 3,
      INVOICE: 4
    }[item.evidenceType];
    return Math.max(best, rank);
  }, 0);

  return [0, 60, 75, 90, 100][strongestType] ?? 0;
}

export function evaluateProductOpportunity(
  input: ProductOpportunityInput,
  options: { now?: Date; minimumMarginPct?: number } = {}
): ProductOpportunityResult {
  const quoteEvaluation = evaluateSupplierQuote(input.quote, {
    now: options.now,
    minimumMarginPct: options.minimumMarginPct ?? 35
  });

  const components = {
    economics: economicsScore(quoteEvaluation),
    evidence: evidenceScore(input.quote, quoteEvaluation),
    provenance: clampScore(input.provenanceScore),
    supplierReliability: clampScore(input.supplierReliabilityScore),
    demand: clampScore(input.demandScore, 50),
    catalogGap: clampScore(input.catalogGapScore, 50)
  };

  // Weighted score is advisory only. Hard gates below cannot be overridden by a high score.
  const score = Math.round(
    components.economics * 0.3 +
      components.evidence * 0.2 +
      components.provenance * 0.15 +
      components.supplierReliability * 0.15 +
      components.demand * 0.1 +
      components.catalogGap * 0.1
  );

  const hardGateReasons = [...quoteEvaluation.reasons];
  if (input.provenanceScore === undefined || input.provenanceScore < 60) {
    hardGateReasons.push("provenance evidence score is below 60");
  }
  if (input.supplierReliabilityScore === undefined || input.supplierReliabilityScore < 50) {
    hardGateReasons.push("supplier reliability evidence score is below 50");
  }

  const eligibleForCouncil = quoteEvaluation.eligibleForCouncil && hardGateReasons.length === 0;
  const tier: ProductOpportunityResult["tier"] = !eligibleForCouncil
    ? "HOLD"
    : score >= 85
      ? "A"
      : score >= 70
        ? "B"
        : "C";

  return {
    id: input.id,
    productName: input.productName,
    score,
    tier,
    eligibleForCouncil,
    hardGateReasons,
    quoteEvaluation,
    components
  };
}

export function rankProductOpportunities(inputs: ProductOpportunityInput[]) {
  return inputs
    .map((input) => evaluateProductOpportunity(input))
    .sort((a, b) => {
      if (a.eligibleForCouncil !== b.eligibleForCouncil) return a.eligibleForCouncil ? -1 : 1;
      return b.score - a.score;
    });
}
