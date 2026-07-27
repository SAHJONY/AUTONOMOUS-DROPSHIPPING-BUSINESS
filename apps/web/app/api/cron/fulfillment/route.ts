import { json, error } from "@/lib/api";
import { CRON_SECRET } from "@/lib/config";
import { runFulfillmentCycle } from "@/lib/fulfillment";
import { getShopifyCreds, listAllOrgs } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The fulfillment heartbeat.
 *
 * Runs far more often than the daily CEO cycle because it is the clock the
 * customer experiences: every pass pulls new orders, buys the goods for anything
 * within the cost cap, and pushes tracking numbers out. No agent, no model calls
 * — just the operational loop, so it is cheap enough to run hourly.
 */
async function handle(req: Request) {
  if (CRON_SECRET) {
    const header = req.headers.get("authorization") ?? "";
    const secret = new URL(req.url).searchParams.get("secret") ?? "";
    if (header !== `Bearer ${CRON_SECRET}` && secret !== CRON_SECRET) {
      return error("Unauthorized", 401);
    }
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
