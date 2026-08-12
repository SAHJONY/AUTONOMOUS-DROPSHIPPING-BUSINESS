/**
 * Autonomous supplier discovery.
 *
 * The intelligence sweep works out which SKUs the catalog is missing. This goes
 * looking for someone who can supply them, on the open web, without being asked.
 *
 * Three constraints shape the whole module:
 *
 *  1. **The niche gate is fail-closed.** Every query is built from a gap item's
 *     lane — which fixes the religious tradition, so the anchor term is real
 *     context rather than a phrase bolted on to satisfy a check — and is then
 *     asserted against `botanica-policy`. A query that cannot be shown to target
 *     Botanica/Lucumi/Orisha merchandise is not run.
 *  2. **Web search is metered and neither provider caps spending.** Brave ended
 *     its free tier in February 2026 and bills past a $5 monthly credit with no
 *     ceiling; Google CSE is free to 100/day but closed to new customers and
 *     retires in January 2027. An unattended loop against an uncapped meter is a
 *     runaway bill, so this module keeps its own hard daily budget in the KV
 *     store and stops when it is spent.
 *  3. **Discovery converges.** A host that has already been recorded is never
 *     researched again, so the query spend falls to nothing once the gap is
 *     covered — the same shape as the trade lookups.
 *
 * Nothing here contacts a supplier, publishes, or spends at a supplier. It
 * produces ranked *candidates* that still require the owner's verification, the
 * same posture as the Accio intake.
 */
import { assertBotanicaSourcingQuery, botanicaRelevantText, BOTANICA_SOURCING_QUERIES } from "./botanica-policy";
import { isBlockedCompetitorHostname } from "./competitor-price-monitor";
import { kv } from "./kv";
import { recall, remember } from "./store";
import type { AssortmentGapItem } from "./intelligence";

export type SearchProvider = "brave" | "google_cse" | "none";

/** Platform-wide ceiling on paid search queries per UTC day. The runaway-bill brake. */
export const DISCOVERY_DAILY_BUDGET = Math.max(0, Number(process.env.SUPPLIER_DISCOVERY_DAILY_BUDGET ?? 50) || 0);
/** Queries one org may spend in a single tick. */
export const DISCOVERY_QUERIES_PER_TICK = Math.max(0, Number(process.env.SUPPLIER_DISCOVERY_QUERIES_PER_TICK ?? 2) || 0);
/** Memory key prefix under which a discovered supplier host is filed. */
export const CANDIDATE_MEMORY_PREFIX = "supplier-candidate:";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1_000_000;

/** Places that sell to consumers. Real merchandise, but not a supplier to onboard. */
const MARKETPLACE_HOSTS = [
  "amazon.", "ebay.", "etsy.", "aliexpress.", "walmart.", "temu.", "wish.com", "mercadolibre.",
  "pinterest.", "facebook.", "instagram.", "tiktok.", "youtube.", "reddit.", "wikipedia.",
  "x.com", "twitter.", "linkedin.", "quora.", "alibaba.com/product-detail",
];

/**
 * The four tiers of the supply chain, best counterparty first.
 *
 * The tier matters more than any other signal: a manufacturer sells at the
 * lowest cost and can private-label, a distributor carries breadth, a wholesaler
 * is the MOQ-friendly middle, and a reseller is the thinnest margin of the four.
 * All four are worth finding — they are ranked, not filtered.
 */
export type SupplierTier = "MANUFACTURER" | "DISTRIBUTOR" | "WHOLESALER" | "RESELLER" | "UNKNOWN";

/** Ordered strongest-first: the first tier whose vocabulary matches wins. */
export const SUPPLIER_TIERS: Array<Exclude<SupplierTier, "UNKNOWN">> = ["MANUFACTURER", "DISTRIBUTOR", "WHOLESALER", "RESELLER"];

/** Bilingual vocabulary per tier — this catalog's suppliers advertise in both. */
const TIER_SIGNALS: Record<Exclude<SupplierTier, "UNKNOWN">, string[]> = {
  // Factory vocabulary plus the words small-batch makers actually use. A
  // Nashville workshop pouring oils by hand is a manufacturer; it just never
  // says "OEM".
  MANUFACTURER: [
    "manufacturer", "fabricante", "factory", "fábrica", "fabrica", "oem", "odm",
    "private label", "marca propia", "we manufacture", "nuestra fábrica",
    "handmade in-house", "made in-house", "artisan-made", "artesanal", "hecho a mano",
    "our workshop", "nuestro taller", "we produce", "producimos", "poured in", "we pour",
  ],
  DISTRIBUTOR: ["distributor", "distribuidor", "distribuidora", "importer", "importador", "importadora", "authorized dealer", "distribución"],
  WHOLESALER: ["wholesale", "mayorista", "mayoreo", "al por mayor", "bulk", "moq", "minimum order", "pedido mínimo"],
  RESELLER: ["reseller", "revendedor", "trade account", "cuenta de comerciante", "dealer", "b2b"],
};

/** Generic trade words: they show business intent but do not identify a tier. */
const TRADE_SIGNALS = ["supplier", "proveedor", "catalog", "catálogo", "price list", "lista de precios", "wholesale inquiry"];

/** How much each tier is worth as a counterparty. */
const TIER_SCORE: Record<SupplierTier, number> = { MANUFACTURER: 45, DISTRIBUTOR: 35, WHOLESALER: 28, RESELLER: 12, UNKNOWN: 0 };

/** The tier a page advertises itself as, with the words that said so. */
export function classifySupplierTier(text: string): { tier: SupplierTier; signals: string[] } {
  const haystack = text.toLowerCase();
  for (const tier of SUPPLIER_TIERS) {
    const signals = TIER_SIGNALS[tier].filter((signal) => haystack.includes(signal));
    if (signals.length > 0) return { tier, signals };
  }
  return { tier: "UNKNOWN", signals: [] };
}

export function discoveryProvider(): SearchProvider {
  if (process.env.BRAVE_SEARCH_API_KEY?.trim()) return "brave";
  if (process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_ID?.trim()) return "google_cse";
  return "none";
}

/** How to ask for each tier, in the words those businesses use about themselves. */
const TIER_QUERY: Record<Exclude<SupplierTier, "UNKNOWN">, string> = {
  MANUFACTURER: "manufacturer factory OEM private label",
  DISTRIBUTOR: "distributor importer distribuidor",
  WHOLESALER: "wholesale supplier mayorista",
  RESELLER: "reseller trade account revendedor",
};

/**
 * Which tier this tick hunts for. Rotating rather than firing all four at once
 * keeps the query spend flat while still covering the whole supply chain — the
 * same trick the agent shift rotation uses.
 */
export function tierForTick(date: Date = new Date()): Exclude<SupplierTier, "UNKNOWN"> {
  return SUPPLIER_TIERS[date.getUTCHours() % SUPPLIER_TIERS.length];
}

/** The religious tradition each sourcing lane belongs to — the query's real anchor. */
const LANE_ANCHOR: Record<string, string> = {
  NIGERIA_YORUBA: "ifa orisha",
  CUBAN_LUCUMI: "lucumi santeria",
  BOTANICA_CONSUMABLES: "botanica religious",
};

/**
 * Search queries for the gaps worth filling, most urgent first.
 *
 * Pure, and fail-closed: anything that cannot be shown to target the niche is
 * dropped rather than searched.
 */
export function buildDiscoveryQueries(missing: AssortmentGapItem[], tier: Exclude<SupplierTier, "UNKNOWN"> = "WHOLESALER"): string[] {
  const ask = TIER_QUERY[tier];
  const queries: string[] = [];
  for (const item of missing) {
    const anchor = LANE_ANCHOR[item.lane];
    if (!anchor) continue;
    const query = `${item.title} ${anchor} ${ask}`;
    if (assertBotanicaSourcingQuery(query).ok) queries.push(query);
  }
  // With nothing missing, fall back to the standing niche queries so discovery
  // still widens the supplier bench rather than idling.
  if (queries.length === 0) queries.push(...BOTANICA_SOURCING_QUERIES.map((q) => `${q} ${ask}`));
  return queries;
}

export interface SearchHit { title: string; url: string; description: string }

export interface SupplierCandidate extends SearchHit {
  host: string;
  tier: SupplierTier;
  score: number;
  signals: string[];
  query: string;
}

export function hostOf(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || isBlockedCompetitorHostname(url.hostname)) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Rank a search hit as a supplier prospect. Returns null for anything that is
 * not plausibly a supplier of this merchandise — a marketplace listing, an
 * unreachable host, or a page with no demonstrable niche relevance.
 */
export function scoreSupplierCandidate(hit: SearchHit, query = ""): SupplierCandidate | null {
  const host = hostOf(hit.url);
  if (!host) return null;
  const haystack = `${hit.title} ${hit.description} ${hit.url}`.toLowerCase();
  if (MARKETPLACE_HOSTS.some((marketplace) => haystack.includes(marketplace))) return null;
  if (!botanicaRelevantText(haystack)) return null;

  // Niche relevance is the price of entry; where the candidate sits in the
  // supply chain is what ranks, with generic trade wording as a tie-breaker.
  const { tier, signals } = classifySupplierTier(haystack);
  const trade = TRADE_SIGNALS.filter((signal) => haystack.includes(signal));
  const score = Math.min(100, 30 + TIER_SCORE[tier] + Math.min(20, (signals.length + trade.length) * 5));
  return { ...hit, host, tier, score, signals: [...signals, ...trade], query };
}

const budgetKey = () => `discovery:budget:${new Date().toISOString().slice(0, 10)}`;

/** Claim one query against today's platform-wide budget. False when it is spent. */
async function claimBudget(): Promise<boolean> {
  if (DISCOVERY_DAILY_BUDGET <= 0) return false;
  const key = budgetKey();
  const used = Number((await kv.get<number>(key)) ?? 0);
  if (used >= DISCOVERY_DAILY_BUDGET) return false;
  await kv.set(key, used + 1);
  return true;
}

export async function discoveryBudgetRemaining(): Promise<number> {
  const used = Number((await kv.get<number>(budgetKey())) ?? 0);
  return Math.max(0, DISCOVERY_DAILY_BUDGET - used);
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const raw = (await response.text()).slice(0, MAX_RESPONSE_BYTES + 1);
    if (raw.length > MAX_RESPONSE_BYTES || !response.ok) return null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** One search against whichever provider is configured, normalized to hits. */
export async function searchWeb(query: string): Promise<SearchHit[]> {
  const provider = discoveryProvider();
  if (provider === "brave") {
    const data = await fetchJson(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!.trim() },
    ) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } } | null;
    return (data?.web?.results ?? []).map((r) => ({ title: String(r.title ?? ""), url: String(r.url ?? ""), description: String(r.description ?? "") }));
  }
  if (provider === "google_cse") {
    const data = await fetchJson(
      `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(process.env.GOOGLE_CSE_API_KEY!.trim())}&cx=${encodeURIComponent(process.env.GOOGLE_CSE_ID!.trim())}&q=${encodeURIComponent(query)}&num=10`,
      { Accept: "application/json" },
    ) as { items?: Array<{ title?: string; link?: string; snippet?: string }> } | null;
    return (data?.items ?? []).map((r) => ({ title: String(r.title ?? ""), url: String(r.link ?? ""), description: String(r.snippet ?? "") }));
  }
  return [];
}

export interface DiscoveryResult {
  provider: SearchProvider;
  /** The supply-chain tier hunted this tick. */
  tier: Exclude<SupplierTier, "UNKNOWN">;
  queries_run: number;
  candidates: SupplierCandidate[];
  by_tier: Record<SupplierTier, number>;
  known_hosts_skipped: number;
  budget_remaining: number;
  /** Set when discovery stopped early rather than completing its queries. */
  stopped?: "no_provider" | "budget_spent" | "disabled";
}

/**
 * Look for suppliers who could fill the current gaps, and file what is found.
 *
 * Bounded three ways: the per-tick query allowance, the platform-wide daily
 * budget, and the fact that an already-known host is never searched for twice.
 */
export async function discoverSuppliers(orgId: string, missing: AssortmentGapItem[], tier = tierForTick()): Promise<DiscoveryResult> {
  const provider = discoveryProvider();
  const result: DiscoveryResult = {
    provider, tier, queries_run: 0, candidates: [],
    by_tier: { MANUFACTURER: 0, DISTRIBUTOR: 0, WHOLESALER: 0, RESELLER: 0, UNKNOWN: 0 },
    known_hosts_skipped: 0, budget_remaining: await discoveryBudgetRemaining(),
  };
  if (provider === "none") return { ...result, stopped: "no_provider" };
  if (DISCOVERY_QUERIES_PER_TICK <= 0 || DISCOVERY_DAILY_BUDGET <= 0) return { ...result, stopped: "disabled" };

  const known = new Set(
    (await recall(orgId, CANDIDATE_MEMORY_PREFIX, 500))
      .filter((entry) => entry.key.startsWith(CANDIDATE_MEMORY_PREFIX))
      .map((entry) => entry.key.slice(CANDIDATE_MEMORY_PREFIX.length)),
  );

  for (const query of buildDiscoveryQueries(missing, tier)) {
    if (result.queries_run >= DISCOVERY_QUERIES_PER_TICK) break;
    if (!(await claimBudget())) {
      result.stopped = "budget_spent";
      break;
    }
    result.queries_run++;
    for (const hit of await searchWeb(query)) {
      const candidate = scoreSupplierCandidate(hit, query);
      if (!candidate) continue;
      if (known.has(candidate.host)) {
        result.known_hosts_skipped++;
        continue;
      }
      known.add(candidate.host);
      result.candidates.push(candidate);
      result.by_tier[candidate.tier]++;
      await remember(orgId, `${CANDIDATE_MEMORY_PREFIX}${candidate.host}`, JSON.stringify(candidate).slice(0, 2000), "discovery");
    }
  }

  result.candidates.sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
  result.budget_remaining = await discoveryBudgetRemaining();
  return result;
}
