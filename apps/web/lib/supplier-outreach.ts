/**
 * From a discovered candidate to an email the owner can actually send.
 *
 * Discovery finds suppliers and the templates in `supplier-communications.ts`
 * ask the right questions, but nothing joined them: the owner still had to
 * decide which template a candidate deserved and retype the company name.
 *
 * What you ask for depends on where a supplier sits in the chain. A
 * manufacturer is worth asking about private label, because that is the only
 * tier that can make goods under your own brand. A distributor or wholesaler is
 * worth asking for a trade account and a catalog. A reseller is worth asking
 * for terms before anything else, since the margin is thin enough that the
 * terms decide whether it is worth doing at all.
 *
 * This drafts. It never sends: cold outreach picks its own recipient, which is
 * exactly what `botanica-email.ts` refuses to let an agent do, so the owner
 * sends these from Owner OS with the usual typed confirmation.
 */
import { buildSupplierCommunication, type SupplierCommunicationKind, type SupplierCommunicationLanguage } from "./supplier-communications";
import type { SupplierTier } from "./supplier-discovery";

/** What to ask each tier for first. */
export const TIER_OPENING: Record<SupplierTier, SupplierCommunicationKind> = {
  MANUFACTURER: "PRIVATE_LABEL",
  DISTRIBUTOR: "WHOLESALE_ACCOUNT",
  WHOLESALER: "WHOLESALE_ACCOUNT",
  RESELLER: "CATALOG_QUOTE",
  UNKNOWN: "CATALOG_QUOTE",
};

/** Why that opening, in the owner's language, so the choice is reviewable. */
const TIER_REASON: Record<SupplierTier, string> = {
  MANUFACTURER: "Fabricante: es el único nivel que puede producir con marca propia, así que la primera pregunta es esa.",
  DISTRIBUTOR: "Distribuidor: pide cuenta mayorista y condiciones antes que precios sueltos.",
  WHOLESALER: "Mayorista: pide cuenta mayorista, MOQ y política de reventa.",
  RESELLER: "Revendedor: el margen es estrecho, así que pide catálogo y precios antes de invertir tiempo.",
  UNKNOWN: "Nivel sin clasificar: pide catálogo y condiciones para saber con quién estás tratando.",
};

export interface OutreachCandidate {
  host: string;
  title?: string;
  tier?: string;
  score?: number;
}

export interface OutreachDraft {
  host: string;
  supplierName: string;
  tier: SupplierTier;
  kind: SupplierCommunicationKind;
  reason: string;
  subject: string;
  body: string;
  /** Always false. The owner sends; nothing here contacts anyone. */
  sent: false;
}

const KNOWN_TIERS = new Set<SupplierTier>(["MANUFACTURER", "DISTRIBUTOR", "WHOLESALER", "RESELLER", "UNKNOWN"]);

function tierOf(value: unknown): SupplierTier {
  const tier = String(value ?? "UNKNOWN").toUpperCase() as SupplierTier;
  return KNOWN_TIERS.has(tier) ? tier : "UNKNOWN";
}

/**
 * Draft the opening email for one candidate.
 *
 * The company name falls back to the host rather than the template's
 * `[NOMBRE DEL PROVEEDOR]` placeholder — a draft addressed to a placeholder is
 * one the owner has to fix before sending, which defeats the point.
 */
export function draftSupplierOutreach(
  candidate: OutreachCandidate,
  language: SupplierCommunicationLanguage = "es",
  kindOverride?: SupplierCommunicationKind,
): OutreachDraft {
  const tier = tierOf(candidate.tier);
  const kind = kindOverride ?? TIER_OPENING[tier];
  const supplierName = String(candidate.title ?? "").trim() || candidate.host;
  const { subject, body } = buildSupplierCommunication(kind, language, supplierName);
  return { host: candidate.host, supplierName, tier, kind, reason: TIER_REASON[tier], subject, body, sent: false };
}

/**
 * Draft for a whole bench, best counterparty first.
 *
 * Ranked by tier then score, so the manufacturer worth private-labelling is the
 * first email the owner reads rather than the twelfth.
 */
export function draftOutreachForBench(
  candidates: OutreachCandidate[],
  language: SupplierCommunicationLanguage = "es",
): OutreachDraft[] {
  const rank: Record<SupplierTier, number> = { MANUFACTURER: 0, DISTRIBUTOR: 1, WHOLESALER: 2, RESELLER: 3, UNKNOWN: 4 };
  // Rank the candidates, then draft. Sorting the drafts instead would compare a
  // score the draft does not carry.
  return [...(candidates ?? [])]
    .sort((a, b) =>
      rank[tierOf(a.tier)] - rank[tierOf(b.tier)] ||
      (Number(b.score) || 0) - (Number(a.score) || 0) ||
      a.host.localeCompare(b.host))
    .map((candidate) => draftSupplierOutreach(candidate, language));
}
