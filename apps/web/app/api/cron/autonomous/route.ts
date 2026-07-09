import { json, error } from "@/lib/api";
import { CRON_SECRET } from "@/lib/config";
import { runAgent } from "@/lib/brain";
import { listAllOrgs } from "@/lib/store";

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
      const run = await runAgent({
        orgId: org.id,
        agentName: "ceo",
        task:
          "Autonomous 24/7 cycle. Move the business forward, don't just report. Steps: (1) get the " +
          "business snapshot and list products; (2) if fewer than 3 launch-ready products exist, " +
          "dispatch product_hunter to find and score new opportunities; (3) for the best ready_to_launch " +
          "product with no listing, dispatch store_builder to write one, and dispatch finance to verify " +
          "unit economics; (4) dispatch marketing for a creative brief on the top product; (5) queue any " +
          "high-risk actions (store creation, budgets) for owner approval — never wait on them; " +
          "(6) file a concise report (what advanced today, key numbers, pending approvals, next action) " +
          "to memory. Make reasonable assumptions; never stop to ask a human.",
      });
      results.push({ org: org.id, name: org.name, run_id: run.id, status: run.status });
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
