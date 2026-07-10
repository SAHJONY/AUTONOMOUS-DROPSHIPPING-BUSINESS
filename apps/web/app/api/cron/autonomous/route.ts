import { json, error } from "@/lib/api";
import { CRON_SECRET } from "@/lib/config";
import { autoApprovePending, runAgent } from "@/lib/brain";
import {
  autoPublishReady,
  autonomousSource,
  getCJCreds,
  getShopifyCreds,
  listAllOrgs,
  listProducts,
} from "@/lib/store";

export const runtime = "nodejs";
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
      const [shop, cjc, products] = await Promise.all([
        getShopifyCreds(org.id),
        getCJCreds(org.id),
        listProducts(org.id),
      ]);
      if (!shop && !cjc && products.length === 0) continue;

      // 1. Source real products from the supplier (CJ) when stock is thin.
      const sourced = await autonomousSource(org.id);

      // 2. Run the CEO cycle to advance the business.
      const run = await runAgent({
        orgId: org.id,
        agentName: "ceo",
        task:
          "Autonomous 24/7 cycle. Move the business forward, don't just report. Review the snapshot and " +
          "catalog; if a supplier is connected, ensure the store is stocked; for the best ready_to_launch " +
          "products write listings and verify unit economics; dispatch marketing for a creative brief on " +
          "the top product; queue any high-risk actions for owner approval — never wait on them; file a " +
          "concise report to memory. Make reasonable assumptions; never stop to ask a human.",
      });

      // 3. Auto-approve within thresholds, then publish everything ready.
      const autoApproved = await autoApprovePending(org.id);
      const published = await autoPublishReady(org.id);
      results.push({
        org: org.id,
        name: org.name,
        run_id: run.id,
        status: run.status,
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
