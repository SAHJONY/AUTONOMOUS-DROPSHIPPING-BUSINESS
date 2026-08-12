/**
 * The standing intelligence sweep.
 *
 * The registries, scoring matrices and trade lookups in this codebase were all
 * built as things the owner consults. Consulted intelligence is only as fresh
 * as the last time somebody remembered to look, which on a business meant to
 * run itself is the wrong shape: the fleet should arrive on shift already
 * knowing what the catalog is missing and which suppliers are still unresearched.
 *
 * So every tick this joins the static sourcing basket against the live catalog,
 * works out what is genuinely not covered, and files the result into business
 * memory where the next agent shift recalls it.
 *
 * It then goes looking for someone who can supply the gaps — see
 * `supplier-discovery.ts`, which carries its own budget brake.
 *
 * Two properties keep it cheap enough to run forever:
 *
 *  - The analysis is pure and deterministic — no model, no network.
 *  - Every paid call converges. The NBD trade lookup fires only for a supplier
 *    the org has no profile for yet, and discovery only for a host it has never
 *    seen. Research is something you finish, so the steady state is zero calls.
 */
import { getBotanicaFirst25SourcingMatrix } from "./botanica-first-25-sourcing-matrix";
import { BOTANICA_FIRST_25_SKU_CANDIDATES } from "./botanica-first-25-sku-candidates";
import { getPublicPriceEvidenceForSupplier } from "./botanica-public-price-evidence";
import { getNbdTradeStatus, nbdFindCompanies } from "./nbd-trade";
import { discoverSuppliers, type DiscoveryResult } from "./supplier-discovery";
import { recall, remember } from "./store";

/** Trade lookups attempted per org per tick. Zero disables the paid API entirely. */
export const TRADE_LOOKUPS_PER_TICK = Math.max(0, Number(process.env.AUTONOMY_TRADE_LOOKUPS ?? 2) || 0);

/** Memory key prefix under which a researched supplier trade profile is filed. */
export const TRADE_MEMORY_PREFIX = "trade:";

export interface AssortmentGapItem {
  sku: string;
  title: string;
  lane: string;
  supplier: string;
  priority: string;
  nextAction: string;
  missingEvidence: string[];
  /** True when no public price observation exists for this candidate's supplier. */
  needsPriceEvidence: boolean;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * What the live catalog is still missing from the first-25 sourcing basket.
 *
 * A candidate counts as covered when the catalog carries its SKU, or a product
 * whose title matches the candidate's. Pure so the rule is directly testable.
 */
export function buildAssortmentGap(products: Array<{ sku?: string; title?: string }>) {
  const skus = new Set(products.map((p) => normalize(String(p.sku ?? ""))).filter(Boolean));
  const titles = new Set(products.map((p) => normalize(String(p.title ?? ""))).filter(Boolean));
  const matrix = new Map(getBotanicaFirst25SourcingMatrix().map((row) => [row.sku, row]));

  const covered: string[] = [];
  const missing: AssortmentGapItem[] = [];

  for (const candidate of BOTANICA_FIRST_25_SKU_CANDIDATES) {
    if (skus.has(normalize(candidate.sku)) || titles.has(normalize(candidate.title))) {
      covered.push(candidate.sku);
      continue;
    }
    const row = matrix.get(candidate.sku);
    missing.push({
      sku: candidate.sku,
      title: candidate.title,
      lane: candidate.lane,
      supplier: candidate.supplier,
      priority: row?.priority ?? "P2",
      nextAction: row?.nextAction ?? "Verificar evidencia de proveedor antes de sourcing.",
      missingEvidence: row ? [...row.missingEvidence] : [],
      needsPriceEvidence: getPublicPriceEvidenceForSupplier(candidate.supplier).length === 0,
    });
  }

  // P1 first — the basket is prioritized, and so is the worklist derived from it.
  const rank: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
  missing.sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || a.sku.localeCompare(b.sku));

  const total = BOTANICA_FIRST_25_SKU_CANDIDATES.length;
  return {
    total,
    covered: covered.length,
    coveragePercent: total > 0 ? Math.round(covered.length / total * 1000) / 10 : 0,
    missing,
    p1Missing: missing.filter((m) => m.priority === "P1").length,
    needingPriceEvidence: missing.filter((m) => m.needsPriceEvidence).length,
  };
}

/** Suppliers named by unmet P1 candidates, most urgent first, de-duplicated. */
export function suppliersToResearch(gap: ReturnType<typeof buildAssortmentGap>): string[] {
  const seen = new Set<string>();
  for (const item of gap.missing) {
    const supplier = item.supplier?.trim();
    if (supplier) seen.add(supplier);
  }
  return [...seen];
}

export interface IntelligenceBrief {
  generated_at: string;
  assortment: ReturnType<typeof buildAssortmentGap>;
  trade: { configured: boolean; researched: string[]; failed: string[]; skipped_known: number };
  discovery: DiscoveryResult;
}

/**
 * Run the sweep for one org and file the brief into business memory.
 *
 * Never publishes, never spends at a supplier, never contacts anyone. The only
 * outbound calls are the trade lookup and web search, both bounded and both
 * skipped for anything already researched.
 */
export async function runIntelligenceSweep(orgId: string, products: Array<{ sku?: string; title?: string }>): Promise<IntelligenceBrief> {
  const assortment = buildAssortmentGap(products);
  const trade: IntelligenceBrief["trade"] = { configured: getNbdTradeStatus().configured, researched: [], failed: [], skipped_known: 0 };

  if (trade.configured && TRADE_LOOKUPS_PER_TICK > 0) {
    const known = new Set(
      (await recall(orgId, TRADE_MEMORY_PREFIX, 500))
        .filter((entry) => entry.key.startsWith(TRADE_MEMORY_PREFIX))
        .map((entry) => entry.key.slice(TRADE_MEMORY_PREFIX.length)),
    );
    for (const supplier of suppliersToResearch(assortment)) {
      if (trade.researched.length + trade.failed.length >= TRADE_LOOKUPS_PER_TICK) break;
      if (known.has(supplier)) {
        trade.skipped_known++;
        continue;
      }
      const lookup = await nbdFindCompanies(supplier);
      if (lookup.ok) {
        await remember(orgId, `${TRADE_MEMORY_PREFIX}${supplier}`, JSON.stringify(lookup.data).slice(0, 4000), "intelligence");
        trade.researched.push(supplier);
      } else {
        trade.failed.push(supplier);
      }
    }
  }

  // Go looking for someone who can supply what the catalog is missing.
  const discovery = await discoverSuppliers(orgId, assortment.missing);

  const brief: IntelligenceBrief = { generated_at: new Date().toISOString(), assortment, trade, discovery };
  await remember(orgId, "intelligence:assortment-gap", JSON.stringify(brief).slice(0, 8000), "intelligence");
  return brief;
}
