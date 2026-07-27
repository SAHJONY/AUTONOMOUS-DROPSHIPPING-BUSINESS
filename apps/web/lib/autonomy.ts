/**
 * 24/7 autonomy — the shift scheduler.
 *
 * The fleet works in shifts. Every tick one agent comes on duty (the CEO or a
 * specialist, rotating through the whole roster) with a concrete duty brief,
 * and the deterministic housekeeping that needs no model — supplier sourcing,
 * autopilot approvals, publishing — runs on every single tick.
 *
 * With an hourly heartbeat the eight-agent roster completes three full
 * rotations a day, so every specialist contributes around the clock while
 * token spend stays bounded (one agent per tick, not eight).
 */
import { autoApprovePending, runAgent } from "./brain";
import { runFulfillmentCycle } from "./fulfillment";
import {
  autoPublishReady,
  autonomousSource,
  getCJCreds,
  getShopifyCreds,
  listAllOrgs,
  listProducts,
} from "./store";

/** Max organizations advanced per tick — bounds cost on a busy platform. */
export const MAX_ORGS_PER_TICK = Number(process.env.AUTONOMY_MAX_ORGS ?? 25);

/** Stop starting new agent work past this point so the function returns cleanly. */
const SOFT_DEADLINE_MS = Number(process.env.AUTONOMY_DEADLINE_MS ?? 240_000);

export interface Shift {
  agent: string;
  /** What this agent is on duty to accomplish this tick. */
  duty: string;
}

/**
 * The duty roster. Order matters: it is the rotation. Each brief tells the
 * agent to *act*, not to report — the operating directive already forbids
 * stopping to ask a human.
 */
export const SHIFTS: Shift[] = [
  {
    agent: "ceo",
    duty:
      "Autonomous command shift. Move the business forward, don't just report. Start with the " +
      "business snapshot. Clear the order pipeline first: dispatch the supplier agent to fulfill " +
      "anything pending and to explain every on_hold order. Then read the real P&L — if it shows a " +
      "loss, name the line item causing it and act on it before spending anywhere else. Then growth: " +
      "ensure the store is stocked, get the best ready_to_launch products listed, verify unit " +
      "economics, and dispatch the specialist whose work is most overdue. Queue any high-risk action " +
      "for owner approval and keep going — never wait on it. File a concise shift report to memory.",
  },
  {
    agent: "product_hunter",
    duty:
      "Discovery shift. Find and evaluate fresh product opportunities in categories the catalog is " +
      "missing. Score every candidate with the scoring tool — never invent scores — and save each one " +
      "so the pipeline is auditable. Only 85+ is launch-ready. Note what you rejected and why.",
  },
  {
    agent: "supplier",
    duty:
      "Sourcing and fulfillment shift. Clear the order pipeline first: fulfill anything pending and " +
      "explain every on_hold order. Then import real supplier products when stock is thin, compare " +
      "landed cost and shipping times against the catalog, and record supplier quotes, lead times, " +
      "and any reliability issues to memory so future runs price better.",
  },
  {
    agent: "store_builder",
    duty:
      "Merchandising shift. Take the highest-scoring products that lack strong listings and write " +
      "high-converting titles, descriptions, and pricing. Generate product imagery where it is missing, " +
      "then publish what is ready so the storefront is never thin.",
  },
  {
    agent: "marketing",
    duty:
      "Creative shift. Build ad angles, hooks, and a concrete creative brief for the top product — " +
      "TikTok and Meta first, then an email beat. Record each brief in memory so results can be " +
      "compared against the previous shift's angles.",
  },
  {
    agent: "advertising",
    duty:
      "Performance shift. Review campaign performance and the budgets already recorded in memory. " +
      "Propose the budget changes the data supports — scale what works, cut what does not. Budget " +
      "changes are gated; request them and continue.",
  },
  {
    agent: "finance",
    duty:
      "Finance shift. Compute unit economics for the active catalog with the tool — never estimate — " +
      "flag any product whose margin cannot carry ad spend, and file a short P&L snapshot to memory.",
  },
  {
    agent: "support",
    duty:
      "Service shift. Review anything customer-facing that needs a response, draft on-brand replies, " +
      "and record recurring complaints to memory so the product and listing agents can fix the cause. " +
      "Refunds are gated; request them and continue.",
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
  auto_approved?: number;
  auto_published?: number;
  error?: string;
}

/**
 * Advance one organization by one shift.
 *
 * Order is deliberate: customers first. Paid orders are shipped before any
 * model call, so even if the engine is unreachable or the agent shift fails,
 * packages still move and the storefront still stocks itself.
 */
export async function runOrgShift(
  orgId: string,
  orgName: string,
  shifts: Shift[],
): Promise<OrgTickResult> {
  const result: OrgTickResult = { org: orgId, name: orgName };
  try {
    // 1. Ship what is already sold. Paid orders outrank everything else.
    result.fulfillment = (await getShopifyCreds(orgId))
      ? await runFulfillmentCycle(orgId)
      : null;

    // 2. Supplier sourcing — only meaningful when a supplier is connected.
    if (await getCJCreds(orgId)) {
      const sourced = await autonomousSource(orgId);
      result.sourced = sourced.imported;
      if (sourced.error) result.source_error = sourced.error;
    }

    // 3. The agent(s) on duty.
    const agents: string[] = [];
    for (const shift of shifts) {
      const run = await runAgent({ orgId, agentName: shift.agent, task: shift.duty });
      agents.push(shift.agent);
      result.run_id = run.id;
      result.status = run.status;
    }
    result.agent = agents.join(", ");

    // 4. Clear the approval queue within autopilot thresholds, then publish.
    result.auto_approved = await autoApprovePending(orgId);
    result.auto_published = await autoPublishReady(orgId);
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

  return {
    ran: results.length,
    skipped_idle: skipped,
    shift: roster.map((s) => s.agent),
    at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    results,
  };
}
