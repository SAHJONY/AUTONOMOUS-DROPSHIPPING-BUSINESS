import { json, error } from "@/lib/api";
import { AUTONOMY_ENABLED, CRON_SECRET } from "@/lib/config";
import { cronGovernanceStatus } from "@/lib/governance";
import { runFulfillmentCycle } from "@/lib/fulfillment";
import { getShopifyCreds, listAllOrgs } from "@/lib/store";
import { autonomySafety } from "@/lib/autonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The fulfillment heartbeat.
 *
 * This is the clock the customer experiences: every pass pulls new orders, buys
 * the goods for anything within the cost cap, and pushes tracking numbers out.
 * The daily CEO cycle runs a pass too, so the queue is worked twice a day even
 * on the default schedule. No agent, no model calls
 * — just the operational loop, so it is cheap enough to run as often as the
 * hosting plan allows (hourly on Vercel Pro; twice daily on Hobby, which only
 * permits daily schedules).
 */
async function handle(req: Request) {
  // Same fail-closed governance as the other crons: an unconfigured secret
  // disables the endpoint rather than leaving it open, and the release gate can
  // stop it spending money even when the secret is right.
  const header = req.headers.get("authorization") ?? "";
  const governanceStatus = cronGovernanceStatus(header, CRON_SECRET, AUTONOMY_ENABLED);
  if (governanceStatus === 503) {
    return error("Fulfillment cron is disabled: CRON_SECRET is not configured.", 503);
  }
  if (governanceStatus === 401) return error("Unauthorized", 401);
  if (governanceStatus === 423) {
    return error("Autonomous fulfillment is disabled by the release governance gate.", 423);
  }

  // Buying goods unattended on a deployment that cannot remember it bought them
  // is worse than not running at all. Same gate the autonomous tick applies.
  const safety = autonomySafety();
  if (!safety.safe) {
    return json({ ran: 0, held_for_readiness: safety.blockers, at: new Date().toISOString(), results: [] }, 423);
  }

  const results = [];
  for (const org of await listAllOrgs()) {
    // Only orgs with a live storefront can have orders to fulfill.
    if (!(await getShopifyCreds(org.id))) continue;
    try {
      results.push({ org: org.id, name: org.name, ...(await runFulfillmentCycle(org.id)) });
    } catch (e) {
      results.push({ org: org.id, name: org.name, error: (e as Error).message });
    }
  }

  return json({ ran: results.length, at: new Date().toISOString(), results });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
