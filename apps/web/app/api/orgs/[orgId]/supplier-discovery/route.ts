import { json, requireOrgRole } from "@/lib/api";
import { CANDIDATE_MEMORY_PREFIX, DISCOVERY_DAILY_BUDGET, discoveryBudgetRemaining, discoveryProvider, tierForTick, type SupplierTier } from "@/lib/supplier-discovery";
import { recall, listProducts } from "@/lib/store";
import { runIntelligenceSweep } from "@/lib/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supplier candidates the autonomous sweep has found so far.
 *
 * Read-only: it reports what discovery already filed and how much of today's
 * search budget is left. It runs no searches of its own, so opening this page
 * can never cost anything.
 *
 * Every candidate is an unverified web result. Nothing here is a supplier the
 * business has vetted, and none of it authorizes a purchase.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  const candidates = (await recall(orgId, CANDIDATE_MEMORY_PREFIX, 500))
    .filter((entry) => entry.key.startsWith(CANDIDATE_MEMORY_PREFIX))
    .map((entry) => {
      try {
        return { host: entry.key.slice(CANDIDATE_MEMORY_PREFIX.length), found_at: entry.created_at, ...JSON.parse(entry.content) };
      } catch {
        return { host: entry.key.slice(CANDIDATE_MEMORY_PREFIX.length), found_at: entry.created_at };
      }
    })
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

  // Let the owner ask for one rung of the supply chain at a time.
  const wanted = new URL(req.url).searchParams.get("tier")?.toUpperCase();
  const filtered = wanted ? candidates.filter((c) => String(c.tier) === wanted) : candidates;

  const byTier: Record<string, number> = { MANUFACTURER: 0, DISTRIBUTOR: 0, WHOLESALER: 0, RESELLER: 0, UNKNOWN: 0 };
  for (const candidate of candidates) byTier[String(candidate.tier ?? "UNKNOWN") as SupplierTier] += 1;

  return json({
    provider: discoveryProvider(),
    hunting_now: tierForTick(),
    daily_budget: DISCOVERY_DAILY_BUDGET,
    budget_remaining_today: await discoveryBudgetRemaining(),
    total: candidates.length,
    by_tier: byTier,
    candidates: filtered,
    notice: "Candidatos web sin verificar. Confirma identidad, autorización de reventa y precios antes de cualquier compromiso.",
  });
}

/**
 * Run a discovery sweep now, instead of waiting for the next tick.
 *
 * This is the only path in the app that spends search budget on demand, so it
 * is owner-only and reports what it cost. It runs the same code the autonomous
 * tick runs — the gap analysis, the trade lookups and the web search — against
 * the same platform-wide daily ceiling, so pressing the button can never spend
 * more than the loop would have.
 *
 * It still buys nothing and contacts nobody: the result is candidates.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  const before = await discoveryBudgetRemaining();
  const brief = await runIntelligenceSweep(orgId, await listProducts(orgId));
  const after = await discoveryBudgetRemaining();

  return json({
    ran_at: brief.generated_at,
    provider: brief.discovery.provider,
    tier_hunted: brief.discovery.tier,
    queries_spent: before - after,
    budget_remaining_today: after,
    found: brief.discovery.candidates.length,
    known_hosts_skipped: brief.discovery.known_hosts_skipped,
    by_tier: brief.discovery.by_tier,
    candidates: brief.discovery.candidates,
    stopped: brief.discovery.stopped,
    assortment: { coverage_percent: brief.assortment.coveragePercent, p1_missing: brief.assortment.p1Missing, total: brief.assortment.total },
    trade: brief.trade,
    notice: brief.discovery.provider === "none"
      ? "No hay proveedor de búsqueda configurado. Conecta Accio Work por MCP (/api/mcp) o define BRAVE_SEARCH_API_KEY para búsqueda automática."
      : "Candidatos web sin verificar. Confirma identidad, autorización de reventa y precios antes de cualquier compromiso.",
  });
}
