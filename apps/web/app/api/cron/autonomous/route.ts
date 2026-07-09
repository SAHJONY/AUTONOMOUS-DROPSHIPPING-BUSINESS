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
          "Autonomous 24/7 cycle: review the business snapshot, coordinate specialists as needed, " +
          "and file today's structured report (revenue, top products, risks, next actions) to memory.",
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
