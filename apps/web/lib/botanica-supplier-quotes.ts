export type SupplierQuoteCurrency = "USD" | "NGN";
export type SupplierQuoteTradition =
  | "LUCUMI_OCHA"
  | "YORUBA_IFA_ISESE"
  | "YORUBA_CRAFT"
  | "GENERIC_COMPONENT";

export type SupplierQuoteEvidence = {
  sourceUrl: string;
  observedAt: string;
  evidenceType: "PUBLIC_PRICE" | "WRITTEN_QUOTE" | "WHOLESALE_CATALOG" | "INVOICE";
  notes?: string;
};

export type SupplierQuote = {
  id: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  sku?: string;
  countryOfOrigin?: string;
  tradition: SupplierQuoteTradition;
  currency: SupplierQuoteCurrency;
  unitCost: number;
  quantity: number;
  moq?: number;
  freightTotal?: number;
  dutyTotal?: number;
  brokerFeesTotal?: number;
  insuranceTotal?: number;
  domesticShippingTotal?: number;
  otherLandedCostsTotal?: number;
  retailPriceUsd?: number;
  fxRateToUsd?: number;
  evidence: SupplierQuoteEvidence[];
  exportVerified: boolean;
  culturalUseVerified: boolean;
  ownerApproved: boolean;
};

export type QuoteEvaluation = {
  quoteId: string;
  eligibleForCouncil: boolean;
  reasons: string[];
  unitCostUsd: number | null;
  landedCostPerUnitUsd: number | null;
  grossMarginPct: number | null;
  evidenceFresh: boolean;
};

const MS_PER_DAY = 86_400_000;

export function isEvidenceFresh(
  evidence: SupplierQuoteEvidence[],
  now = new Date(),
  maxAgeDays = 30
) {
  if (!evidence.length) return false;

  return evidence.every((item) => {
    const observed = new Date(item.observedAt);
    if (Number.isNaN(observed.getTime())) return false;
    const ageDays = (now.getTime() - observed.getTime()) / MS_PER_DAY;
    return ageDays >= 0 && ageDays <= maxAgeDays;
  });
}

export function convertUnitCostToUsd(quote: SupplierQuote) {
  if (quote.unitCost <= 0) return null;
  if (quote.currency === "USD") return quote.unitCost;
  if (!quote.fxRateToUsd || quote.fxRateToUsd <= 0) return null;
  return quote.unitCost * quote.fxRateToUsd;
}

export function calculateLandedCostPerUnitUsd(quote: SupplierQuote) {
  if (quote.quantity <= 0) return null;
  const unitCostUsd = convertUnitCostToUsd(quote);
  if (unitCostUsd === null) return null;

  const adders = [
    quote.freightTotal,
    quote.dutyTotal,
    quote.brokerFeesTotal,
    quote.insuranceTotal,
    quote.domesticShippingTotal,
    quote.otherLandedCostsTotal
  ].reduce((sum, value) => sum + (value ?? 0), 0);

  return unitCostUsd + adders / quote.quantity;
}

export function calculateGrossMarginPct(retailPriceUsd: number, landedCostPerUnitUsd: number) {
  if (retailPriceUsd <= 0 || landedCostPerUnitUsd < 0) return null;
  return ((retailPriceUsd - landedCostPerUnitUsd) / retailPriceUsd) * 100;
}

export function evaluateSupplierQuote(
  quote: SupplierQuote,
  options: { now?: Date; maxEvidenceAgeDays?: number; minimumMarginPct?: number } = {}
): QuoteEvaluation {
  const reasons: string[] = [];
  const now = options.now ?? new Date();
  const maxEvidenceAgeDays = options.maxEvidenceAgeDays ?? 30;
  const minimumMarginPct = options.minimumMarginPct ?? 35;

  const evidenceFresh = isEvidenceFresh(quote.evidence, now, maxEvidenceAgeDays);
  if (!quote.evidence.length) reasons.push("missing supplier/source evidence");
  else if (!evidenceFresh) reasons.push("supplier/source evidence is stale or invalid");

  const unitCostUsd = convertUnitCostToUsd(quote);
  if (unitCostUsd === null) reasons.push("unit cost cannot be normalized to USD");

  if (quote.quantity <= 0) reasons.push("quantity must be greater than zero");
  if (quote.moq !== undefined && quote.moq > quote.quantity) reasons.push("quoted quantity is below supplier MOQ");

  const landedCostPerUnitUsd = calculateLandedCostPerUnitUsd(quote);
  if (landedCostPerUnitUsd === null) reasons.push("landed cost cannot be calculated");

  let grossMarginPct: number | null = null;
  if (quote.retailPriceUsd && landedCostPerUnitUsd !== null) {
    grossMarginPct = calculateGrossMarginPct(quote.retailPriceUsd, landedCostPerUnitUsd);
    if (grossMarginPct !== null && grossMarginPct < minimumMarginPct) {
      reasons.push(`gross margin is below ${minimumMarginPct}%`);
    }
  } else {
    reasons.push("retail price is missing");
  }

  if (quote.countryOfOrigin === "Nigeria" && !quote.exportVerified) {
    reasons.push("Nigeria-direct exportability is not verified");
  }

  if (
    (quote.tradition === "LUCUMI_OCHA" || quote.tradition === "YORUBA_IFA_ISESE") &&
    !quote.culturalUseVerified
  ) {
    reasons.push("tradition-specific cultural use is not verified");
  }

  // Owner approval is deliberately not required to evaluate a quote or send it to the Council.
  // It is required before any purchase or irreversible supplier commitment.
  const eligibleForCouncil = reasons.length === 0;

  return {
    quoteId: quote.id,
    eligibleForCouncil,
    reasons,
    unitCostUsd,
    landedCostPerUnitUsd,
    grossMarginPct,
    evidenceFresh
  };
}

export function canCommitPurchase(quote: SupplierQuote, evaluation: QuoteEvaluation) {
  return evaluation.eligibleForCouncil && quote.ownerApproved;
}

export function rankQuotesByLandedCost(quotes: SupplierQuote[]) {
  return quotes
    .map((quote) => ({ quote, landedCostPerUnitUsd: calculateLandedCostPerUnitUsd(quote) }))
    .filter((entry): entry is { quote: SupplierQuote; landedCostPerUnitUsd: number } => entry.landedCostPerUnitUsd !== null)
    .sort((a, b) => a.landedCostPerUnitUsd - b.landedCostPerUnitUsd);
}
