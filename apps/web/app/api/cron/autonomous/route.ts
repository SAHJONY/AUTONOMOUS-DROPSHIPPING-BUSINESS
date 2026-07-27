import { json, error } from "@/lib/api";
import { CRON_SECRET } from "@/lib/config";
import { autoApprovePending, runAgent } from "@/lib/brain";
import { runFulfillmentCycle } from "@/lib/fulfillment";
import {
  autoPublishReady,
  autonomousSource,
  getCJCreds,
  getShopifyCreds,
  listAllOrgs,
} from "@/lib/store";

export const runtime = "nodejs";
// Higgsfield's API only accepts requests from European IPs — run in Frankfurt.
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 24/7 autonomous operations. Vercel Cron hits this on a schedule; the CEO
 * agent reviews every organization and files a fresh daily report. Secured by
 * CRON_SECRET (Vercel Cron sends it as a Bearer token automatically when set).
 */
async function handle(req: Request) {
  if (CRON_SECRET) {
    const header = req.headers.get("authorization") ?? "";
    const secret = new URL(req.url).searchParams.get("secret") ?? "";
    if (header !== `Bearer ${CRON_SECRET}` && secret !== CRON_SECRET) {
      return error("Unauthorized", 401);
    }
  }

  const orgs = await listAllOrgs();
  const results = [];
  for (const org of orgs) {
    try {
      // Focus the autonomous cycle on orgs with real integrations or a catalog
      // (skips empty throwaway orgs — saves cost and stays on-task).
      const [shop, cjc] = await Promise.all([getShopifyCreds(org.id), getCJCreds(org.id)]);
      // Only run the heavy CEO cycle for orgs with real integrations connected.
      if (!shop && !cjc) continue;

      // 1. Ship what's already sold. Paid orders outrank everything else, so
      //    this runs before any model call — even if the CEO cycle later fails,
      //    customers still get their packages.
      const fulfillment = shop ? await runFulfillmentCycle(org.id) : null;

      // 2. Source real products from the supplier (CJ) when stock is thin.
      const sourced = await autonomousSource(org.id);

      // 3. Run the CEO cycle to advance the business.
      const run = await runAgent({
        orgId: org.id,
        agentName: "ceo",
        task:
          "Autonomous 24/7 cycle. Move the business forward, don't just report. Start with the business " +
          "snapshot. Clear the order pipeline first: dispatch the supplier agent to fulfill anything " +
          "pending and to explain every on_hold order. Then read the real P&L — if it shows a loss, " +
          "name the line item causing it and act on it before spending anywhere else. Then growth: if a " +
          "supplier is connected ensure the store is stocked, write listings for the best " +
          "ready_to_launch products, verify unit economics, and dispatch marketing for a creative brief " +
          "on the top seller. Queue high-risk actions for owner approval — never wait on them. File a " +
          "concise report to memory. Make reasonable assumptions; never stop to ask a human.",
      });

      // 4. Auto-approve within thresholds, then publish everything ready.
      const autoApproved = await autoApprovePending(org.id);
      const published = await autoPublishReady(org.id);
      results.push({
        org: org.id,
        name: org.name,
        run_id: run.id,
        status: run.status,
        fulfillment,
        sourced: sourced.imported,
        source_error: sourced.error,
        auto_approved: autoApproved,
        auto_published: published,
      });
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
