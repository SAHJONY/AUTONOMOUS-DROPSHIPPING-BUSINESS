/**
 * The supplier bench: everyone this business could buy from, in one list.
 *
 * There were two benches and the owner console only showed one. Web discovery
 * files candidates into business memory, while `botanica-supplier-registry.ts`
 * holds the hand-researched suppliers — the ones with real provenance, some of
 * them priority 1. The discovery page read only the first, so it reported zero
 * suppliers to a business that had dozens, and offered a disabled search button
 * as the only way forward.
 *
 * The registry is the better half of the bench and it was invisible. This joins
 * them, classifies the registry entries by the same tier vocabulary discovery
 * uses, and keeps the curated record when both know the same host.
 */
import { BOTANICA_SUPPLIERS, type BotanicaSupplier } from "./botanica-supplier-registry";
import { classifySupplierTier, type SupplierTier } from "./supplier-discovery";

export type BenchSource = "registry" | "web";

export interface BenchEntry {
  host: string;
  title: string;
  url: string;
  description: string;
  tier: SupplierTier;
  score: number;
  source: BenchSource;
  /** Registry only: 1 is the most worth pursuing. */
  researchPriority?: 1 | 2 | 3;
  status?: string;
  found_at?: string;
}

export function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return String(url ?? "").trim().toLowerCase();
  }
}

/**
 * The tier a registry supplier belongs to.
 *
 * Its own words come first, exactly as for a web result. When they say nothing
 * either way, the structured fields do: a supplier kept for custom
 * manufacturing is a manufacturer, and one flagged wholesale is at least a
 * wholesaler. That is inference from curated data, not from a guess.
 */
export function tierOfRegistrySupplier(supplier: BotanicaSupplier): SupplierTier {
  const words = [supplier.name, ...supplier.strengths, ...supplier.categories].join(" ");
  const spoken = classifySupplierTier(words).tier;
  if (spoken !== "UNKNOWN") return spoken;
  if (supplier.sourcingPolicy === "CUSTOM_MANUFACTURING") return "MANUFACTURER";
  return supplier.wholesale ? "WHOLESALER" : "UNKNOWN";
}

/** Research priority 1 is worth more attention than a mid-scoring web result. */
const PRIORITY_SCORE: Record<1 | 2 | 3, number> = { 1: 90, 2: 75, 3: 60 };

export function registryBench(): BenchEntry[] {
  return BOTANICA_SUPPLIERS.map((supplier) => ({
    host: hostOfUrl(supplier.website),
    title: supplier.name,
    url: supplier.website,
    description: [supplier.location, ...supplier.strengths].filter(Boolean).join(" · "),
    tier: tierOfRegistrySupplier(supplier),
    score: PRIORITY_SCORE[supplier.researchPriority],
    source: "registry" as const,
    researchPriority: supplier.researchPriority,
    status: supplier.status,
  }));
}

const RANK: Record<SupplierTier, number> = { MANUFACTURER: 0, DISTRIBUTOR: 1, WHOLESALER: 2, RESELLER: 3, UNKNOWN: 4 };

/**
 * Both benches as one, best counterparty first.
 *
 * When a host is in both, the registry entry wins: it was researched by hand
 * and carries provenance a search snippet does not.
 */
export function buildSupplierBench(discovered: Array<Partial<BenchEntry> & { host: string }> = []): BenchEntry[] {
  const byHost = new Map<string, BenchEntry>();

  for (const entry of discovered) {
    const host = String(entry.host ?? "").toLowerCase().replace(/^www\./, "");
    if (!host) continue;
    byHost.set(host, {
      host,
      title: String(entry.title ?? host),
      url: String(entry.url ?? `https://${host}`),
      description: String(entry.description ?? ""),
      tier: (entry.tier as SupplierTier) ?? "UNKNOWN",
      score: Number(entry.score) || 0,
      source: "web",
      found_at: entry.found_at,
    });
  }

  // Registry second, so it overwrites a web result for the same host.
  for (const entry of registryBench()) byHost.set(entry.host, entry);

  return [...byHost.values()].sort(
    (a, b) => RANK[a.tier] - RANK[b.tier] || b.score - a.score || a.title.localeCompare(b.title),
  );
}

export function benchCountsByTier(bench: BenchEntry[]): Record<SupplierTier, number> {
  const counts: Record<SupplierTier, number> = { MANUFACTURER: 0, DISTRIBUTOR: 0, WHOLESALER: 0, RESELLER: 0, UNKNOWN: 0 };
  for (const entry of bench) counts[entry.tier] += 1;
  return counts;
}
