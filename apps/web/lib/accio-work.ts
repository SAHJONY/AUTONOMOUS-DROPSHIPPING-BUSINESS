import { assertBotanicaSourcingQuery } from "./botanica-policy";

export const ACCIO_WORK_URL = process.env.ACCIO_WORK_URL ?? "https://www.accio.com/work";

export type AccioSourcingBrief = {
  platform: "Accio Work";
  workspace_url: string;
  execution_mode: "external_research_only";
  query: string;
  destination: string;
  prompt: string;
  required_evidence: string[];
  prohibited_actions: string[];
};

/**
 * Build a fail-closed brief for Accio Work. Accio is used as an evidence source,
 * never as an ordering or payment rail; its findings still pass Botanica Council.
 */
export function buildAccioSourcingBrief(input: {
  query: string;
  destination?: string;
  targetRetailUsd?: number;
  maximumMoq?: number;
}): AccioSourcingBrief {
  const query = input.query.trim();
  const relevance = assertBotanicaSourcingQuery(query);
  if (!relevance.ok) throw new Error(relevance.error);

  const destination = input.destination?.trim() || "United States";
  const targetRetail = Math.max(0, Number(input.targetRetailUsd ?? 0));
  const maximumMoq = Math.max(1, Math.floor(Number(input.maximumMoq ?? 1) || 1));
  const economics = targetRetail
    ? `Target retail price: USD ${targetRetail.toFixed(2)}; seek landed unit cost at or below USD ${(targetRetail / 3).toFixed(2)}.`
    : "Return current unit, sample, shipping, duty, and landed-cost evidence; do not estimate missing prices.";

  const requiredEvidence = [
    "supplier legal/business identity and direct source URL",
    "exact product SKU, materials, dimensions, pack/case quantity, and images",
    "current unit price, MOQ, sample terms, stock, lead time, and shipping quote",
    "destination-specific landed cost and delivery estimate",
    "resale authorization, labeling/safety documents, and image-use permission",
    "clear separation of verified facts from supplier claims and unknowns",
  ];
  const prohibitedActions = [
    "placing or confirming an order",
    "authorizing payment, credit terms, contracts, exclusivity, or purchase commitments",
    "publishing products to Shopify",
    "making medical, guaranteed spiritual-outcome, or universal religious claims",
    "treating ritual preparation, consecration, provenance, or Lucumi equivalence as verified without evidence",
  ];

  const prompt = [
    "Act as a read-only sourcing researcher for BOTANICA OCHOSI, a Cuban Botanica / Lucumi / Orisha ecommerce business.",
    `Research: ${query}. Destination: ${destination}. Maximum acceptable MOQ: ${maximumMoq}.`,
    economics,
    `Required evidence: ${requiredEvidence.join("; ")}.`,
    `Do not: ${prohibitedActions.join("; ")}.`,
    "Return a comparison table of up to 10 candidates, cite every source URL, mark every unknown, rank by evidence quality and landed economics, and end with HOLD unless all required evidence is present. Do not contact suppliers or execute transactions.",
  ].join("\n");

  return {
    platform: "Accio Work",
    workspace_url: ACCIO_WORK_URL,
    execution_mode: "external_research_only",
    query,
    destination,
    prompt,
    required_evidence: requiredEvidence,
    prohibited_actions: prohibitedActions,
  };
}
