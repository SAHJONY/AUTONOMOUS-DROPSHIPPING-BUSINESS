import { json, error } from "@/lib/api";
import { AUTONOMY_ENABLED, CRON_SECRET } from "@/lib/config";
import { autoApprovePending } from "@/lib/brain";
import { autoPublishReady, autonomousSource, getCJCreds, listAllOrgs } from "@/lib/store";

export const runtime = "nodejs";
// Higgsfield's API only accepts requests from European IPs — run in Frankfurt.
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Fast autonomous stocking: for every CJ-connected org, source real products
 * and publish everything launch-ready. No CEO agent loop, so it stays well
 * within the function time limit. Secured by CRON_SECRET.
 */
async function handle(req: Request) {
  if (!CRON_SECRET) return error("Stock cron is disabled: CRON_SECRET is not configured.", 503);
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${CRON_SECRET}`) {
    return error("Unauthorized", 401);
  }
  if (!AUTONOMY_ENABLED) {
    return error("Autonomous stocking is disabled by the release governance gate.", 423);
  }

  const orgs = await listAllOrgs();
  const results = [];
  for (const org of orgs) {
    if (!(await getCJCreds(org.id))) continue; // only CJ-connected orgs
    try {
      const sourced = await autonomousSource(org.id);
      const autoApproved = await autoApprovePending(org.id);
      const published = await autoPublishReady(org.id);
      results.push({
        org: org.id,
        name: org.name,
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
