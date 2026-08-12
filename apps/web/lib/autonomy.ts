/**
 * 24/7 autonomy — the BOTANICA OCHOSI shift scheduler.
 *
 * The fleet works in shifts. Every tick one agent comes on duty (the CEO or a
 * specialist, rotating through the whole roster) with a concrete duty brief.
 * Deterministic housekeeping and the Botanica Council run around model work so
 * LLM recommendations can never silently bypass catalog relevance/evidence gates.
 */
import { autoApprovePending, runAgent } from "./brain";
import { runBotanicaCatalogCouncil } from "./botanica-council";
import { BOTANICA_AGENT_DIRECTIVE } from "./botanica-policy";
import { scanCompetitorPricesForOrg } from "./competitor-price-monitor";
import { JWT_SECRET } from "./config";
import { buildForecast } from "./forecast";
import { runFulfillmentCycle } from "./fulfillment";
import { STORAGE_MODE } from "./kv";
import { runIntelligenceSweep } from "./intelligence";
import { getPnl } from "./ledger";
import { assessAutonomySafety } from "./readiness";
import {
  autoPublishReady,
  autonomousSource,
  getCJCreds,
  getShopifyCreds,
  listAllOrgs,
  listProducts,
  remember,
} from "./store";

/** The default baked into config.ts — public in the source, so unusable in production. */
const DEFAULT_JWT_SECRET = "change-me-in-production-commerce-os";

/** Whether this deployment is fit for unattended money-moving work, right now. */
export function autonomySafety() {
  return assessAutonomySafety({ storageMode: STORAGE_MODE, jwtSecretIsDefault: JWT_SECRET === DEFAULT_JWT_SECRET });
}

/** How many competitor listings one org may re-price per tick. */
const COMPETITOR_SCAN_LIMIT = Number(process.env.AUTONOMY_COMPETITOR_SCAN_LIMIT ?? 10);

/** Max organizations advanced per tick — bounds cost on a busy platform. */
export const MAX_ORGS_PER_TICK = Number(process.env.AUTONOMY_MAX_ORGS ?? 25);

/** Stop starting new agent work past this point so the function returns cleanly. */
const SOFT_DEADLINE_MS = Number(process.env.AUTONOMY_DEADLINE_MS ?? 240_000);

export interface Shift {
  agent: string;
  /** What this agent is on duty to accomplish this tick. */
  duty: string;
}

const BOTANICA_SHIFT_PREFIX =
  "BOTANICA OCHOSI operating mode. Work only on a Cuban Botanica / Lucumi / Orisha commerce business. " +
  "Do not source or recommend generic gadgets, pet products, fitness gear, generic beauty devices, or unrelated impulse merchandise. " +
  "Treat cultural/religious accuracy as a constraint, avoid guaranteed spiritual or medical outcomes, and ground product decisions in real supplier/catalog evidence. ";

/**
 * The duty roster. Order matters: it is the rotation. Every duty inherits the
 * Botanica operating constraint as task-level context, in addition to the
 * deterministic supplier and Council gates.
 */
export const SHIFTS: Shift[] = [
  {
    agent: "ceo",
    duty:
      BOTANICA_SHIFT_PREFIX +
      "Autonomous command shift. Move the Botanica forward, don't just report. Start with the " +
      "business snapshot. Clear the order pipeline first: dispatch the supplier agent to fulfill " +
      "anything pending and explain every on_hold order. Then read the real P&L. For growth, prioritize " +
      "authentic Botanica assortment depth, supplier evidence, healthy margins, catalog quality, and " +
      "customer trust. Queue high-risk actions for owner approval and keep going. File a concise shift report.",
  },
  {
    agent: "product_hunter",
    duty:
      BOTANICA_SHIFT_PREFIX +
      "Discovery shift. Find and evaluate fresh Botanica product opportunities in missing categories such as " +
      "religious candles, cascarilla, incense, Orisha devotional items, elekes, ides, statues, books, and other " +
      "clearly relevant supplies. Score every candidate with the deterministic scoring tool and attach real source evidence. " +
      "Never create a generic dropshipping candidate merely because it has high margin or trend momentum.",
  },
  {
    agent: "supplier",
    duty:
      BOTANICA_SHIFT_PREFIX +
      "Sourcing and fulfillment shift. Clear paid orders first. Then source only explicitly relevant Botanica/Lucumi/Orisha " +
      "merchandise. Compare landed cost, lead time, orderability, media quality, and supplier evidence. Record quotes and reliability " +
      "issues in memory. If no relevant product can be verified, return zero candidates rather than broadening the niche.",
  },
  {
    agent: "store_builder",
    duty:
      BOTANICA_SHIFT_PREFIX +
      "Merchandising shift. Improve only Council-eligible Botanica listings. Write respectful Spanish-first titles/descriptions, " +
      "avoid universal religious claims, guaranteed outcomes, or medical claims, and preserve factual supplier/product data. " +
      "Prepare launch-ready catalog items but do not weaken evidence or margin requirements to fill the storefront.",
  },
  {
    agent: "marketing",
    duty:
      BOTANICA_SHIFT_PREFIX +
      "Creative shift. Build culturally respectful marketing angles for verified Botanica products. Focus on education, discovery, " +
      "craftsmanship, assortment, convenience, gifting, and customer service. Do not promise supernatural outcomes or present one " +
      "house/lineage practice as universally binding. Record briefs in memory for comparison.",
  },
  {
    agent: "advertising",
    duty:
      BOTANICA_SHIFT_PREFIX +
      "Performance shift. Review campaign performance and recorded budgets. Propose changes only for verified Botanica catalog items " +
      "whose economics support acquisition spend. Budget changes remain approval-gated.",
  },
  {
    agent: "finance",
    duty:
      BOTANICA_SHIFT_PREFIX +
      "Finance shift. Read the real P&L and compute unit economics for active Botanica products. Flag products below margin floor, " +
      "supplier-cost uncertainty, shipping exposure, or ad economics that cannot support profitable growth. File a short P&L snapshot.",
  },
  {
    agent: "support",
    duty:
      BOTANICA_SHIFT_PREFIX +
      "Service shift. Review customer-facing issues and draft respectful bilingual replies. Do not impersonate a priest, santero, " +
      "babalawo, or other religious authority. Escalate lineage-specific or ceremonial questions when factual confidence is low. " +
      "Refunds remain approval-gated.",
  },
];

/** The agent on duty for a given moment (UTC hour drives the rotation). */
export function shiftFor(date: Date = new Date()): Shift {
  return SHIFTS[date.getUTCHours() % SHIFTS.length];
}

export interface OrgTickResult {
  org: string;
  name: string;
  agent?: string;
  run_id?: string;
  status?: string;
  fulfillment?: Awaited<ReturnType<typeof runFulfillmentCycle>> | null;
  sourced?: number;
  source_error?: string;
  council?: Awaited<ReturnType<typeof runBotanicaCatalogCouncil>>;
  auto_approved?: number;
  auto_published?: number;
  competitor_scan?: Awaited<ReturnType<typeof scanCompetitorPricesForOrg>>;
  forecast_recorded?: boolean;
  intelligence?: { coverage_percent: number; p1_missing: number; researched: number; discovered: number; tier: string };
  intelligence_error?: string;
  /** Set when the deployment is unfit and money-moving steps were skipped. */
  held_for_readiness?: string[];
  error?: string;
}

/**
 * Deterministic intelligence that used to wait for a button press.
 *
 * None of it spends, publishes, or contacts anyone: it re-prices against public
 * competitor listings, files the current projection into business memory, and
 * sweeps the sourcing basket against the live catalog so the next agent shift
 * reasons from live numbers and a real worklist instead of rediscovering them.
 * Because it is harmless it runs even when the deployment is unfit to trade.
 */
async function runOrgIntelligence(orgId: string, result: OrgTickResult): Promise<void> {
  try {
    result.competitor_scan = await scanCompetitorPricesForOrg(orgId, COMPETITOR_SCAN_LIMIT);
  } catch (e) {
    result.competitor_scan = { scanned: 0, updated: 0, failed: 0, error: (e as Error).message } as never;
  }
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  try {
    const [loaded, pnl] = await Promise.all([listProducts(orgId), getPnl(orgId, "90d")]);
    products = loaded;
    const forecast = buildForecast(products, pnl);
    await remember(orgId, "forecast", JSON.stringify(forecast), "autonomy");
    result.forecast_recorded = true;
  } catch {
    result.forecast_recorded = false;
  }
  try {
    const brief = await runIntelligenceSweep(orgId, products);
    result.intelligence = { coverage_percent: brief.assortment.coveragePercent, p1_missing: brief.assortment.p1Missing, researched: brief.trade.researched.length, discovered: brief.discovery.candidates.length, tier: brief.discovery.tier };
  } catch (e) {
    result.intelligence_error = (e as Error).message;
  }
}

/**
 * The sweep's findings as task context for the agent on duty. Empty when the
 * sweep found nothing to say, so a healthy catalog adds no tokens.
 */
export function intelligenceBriefing(result: Pick<OrgTickResult, "intelligence" | "competitor_scan">): string {
  const lines: string[] = [];
  if (result.intelligence) {
    const { coverage_percent, p1_missing, researched, discovered } = result.intelligence;
    lines.push(`Cobertura de la cesta de sourcing: ${coverage_percent}%. Faltan ${p1_missing} SKU de prioridad P1.`);
    if (researched > 0) lines.push(`Se investigaron ${researched} proveedores nuevos con datos de comercio; consulta la memoria con la clave "trade:".`);
    if (discovered > 0) lines.push(`Se encontraron ${discovered} proveedores candidatos nuevos en la web (turno de búsqueda: ${result.intelligence.tier}); están en memoria con la clave "supplier-candidate:" y requieren verificación del propietario antes de cualquier compromiso. Prioriza fabricantes y distribuidores sobre revendedores.`);
  }
  const scan = result.competitor_scan;
  if (scan && scan.updated > 0) lines.push(`Se actualizaron ${scan.updated} precios de competencia esta ronda.`);
  if (lines.length === 0) return "";
  return `\n\nBarrido de inteligencia de esta ronda (ya ejecutado, no lo repitas):\n${lines.map((line) => `- ${line}`).join("\n")}\nRecupera "intelligence:assortment-gap" en memoria para la lista completa de SKU faltantes antes de buscar candidatos nuevos.`;
}

/**
 * Advance one organization by one shift.
 *
 * Order is deliberate: customers first, then sourcing/model work, then the
 * deterministic Council, and only then approval automation + publication.
 */
export async function runOrgShift(
  orgId: string,
  orgName: string,
  shifts: Shift[],
): Promise<OrgTickResult> {
  const result: OrgTickResult = { org: orgId, name: orgName };
  const safety = autonomySafety();
  if (!safety.safe) result.held_for_readiness = safety.blockers;
  try {
    // 1. Ship what is already sold. Paid orders outrank everything else —
    // unless the deployment cannot be trusted to remember that it shipped them.
    result.fulfillment = safety.safe && (await getShopifyCreds(orgId))
      ? await runFulfillmentCycle(orgId)
      : null;

    // 2. Supplier sourcing — the supplier connector itself is Botanica fail-closed.
    if (await getCJCreds(orgId)) {
      const sourced = await autonomousSource(orgId);
      result.sourced = sourced.imported;
      if (sourced.error) result.source_error = sourced.error;
    }

    // 3. Deterministic intelligence, so the shift reasons from live numbers.
    await runOrgIntelligence(orgId, result);

    // 4. The agent(s) on duty, with explicit Botanica task context and the
    // sweep's findings, so the shift starts from the real worklist rather than
    // spending its budget rediscovering what the catalog is already missing.
    const agents: string[] = [];
    const briefing = intelligenceBriefing(result);
    for (const shift of shifts) {
      const run = await runAgent({
        orgId,
        agentName: shift.agent,
        task: `${BOTANICA_AGENT_DIRECTIVE}\n\n${shift.duty}${briefing}`,
      });
      agents.push(shift.agent);
      result.run_id = run.id;
      result.status = run.status;
    }
    result.agent = agents.join(", ");

    // 5. Deterministic Council gate. Any launch candidate that lacks explicit
    // Botanica relevance, supplier evidence, positive economics, margin floor,
    // or safe claims is moved back to analyzed before autonomous publishing.
    result.council = await runBotanicaCatalogCouncil(orgId);

    // 6. Clear safe approvals, then publish only what remains launch-ready.
    // Both execute real actions, so both wait for a deployment fit to trade.
    if (safety.safe) {
      result.auto_approved = await autoApprovePending(orgId);
      result.auto_published = await autoPublishReady(orgId);
    }
  } catch (e) {
    result.error = (e as Error).message;
  }
  return result;
}

/**
 * Is this organization live enough to spend a shift on? Orgs with an
 * integration or a catalog are working businesses; empty throwaway orgs are
 * skipped so cost tracks real activity.
 */
async function isActive(orgId: string): Promise<boolean> {
  const [shop, cj] = await Promise.all([getShopifyCreds(orgId), getCJCreds(orgId)]);
  if (shop || cj) return true;
  const products = await listProducts(orgId);
  return products.length > 0;
}

export interface TickOptions {
  /** Run the entire roster this tick instead of just the agent on duty. */
  all?: boolean;
  /** Explicit agent names to run, overriding the rotation. */
  agents?: string[];
  /** Include organizations with no integrations and an empty catalog. */
  includeIdle?: boolean;
}

/**
 * One heartbeat of the whole platform. Safe to call as often as you like: the
 * work is idempotent, and each tick simply advances every live organization.
 */
export async function runAutonomousTick(opts: TickOptions = {}) {
  const startedAt = Date.now();
  const roster =
    opts.agents?.length
      ? SHIFTS.filter((s) => opts.agents!.includes(s.agent))
      : opts.all
        ? SHIFTS
        : [shiftFor()];

  const orgs = await listAllOrgs();
  const results: OrgTickResult[] = [];
  let skipped = 0;

  for (const org of orgs) {
    if (results.length >= MAX_ORGS_PER_TICK) break;
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
    if (!opts.includeIdle && !(await isActive(org.id))) {
      skipped++;
      continue;
    }
    results.push(await runOrgShift(org.id, org.name, roster));
  }

  const safety = autonomySafety();
  return {
    ran: results.length,
    skipped_idle: skipped,
    /** False when money-moving steps were held back this tick, and why. */
    money_moving_enabled: safety.safe,
    held_for_readiness: safety.safe ? undefined : safety.blockers,
    shift: roster.map((s) => s.agent),
    at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    results,
  };
}
