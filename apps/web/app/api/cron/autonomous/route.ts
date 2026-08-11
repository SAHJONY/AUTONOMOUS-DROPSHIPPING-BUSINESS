import { json, error } from "@/lib/api";
import { AUTONOMY_ENABLED, CRON_SECRET } from "@/lib/config";
import { cronGovernanceStatus } from "@/lib/governance";
import { runAutonomousTick } from "@/lib/autonomy";

export const runtime = "nodejs";
// Higgsfield's API only accepts requests from European IPs — run in Frankfurt.
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The 24/7 heartbeat. Every tick ships what is already sold, then puts one
 * agent on duty — rotating through the whole roster hour by hour — and runs the
 * deterministic housekeeping (sourcing, autopilot approvals, publishing) for
 * every live organization.
 *
 * Query parameters:
 *   ?all=1              run the entire roster this tick instead of the rotation
 *   ?agent=marketing    run specific agents (comma-separated)
 *   ?include_idle=1     also advance orgs with no integrations and no catalog
 *
 * Fail-closed: requires CRON_SECRET to be configured and the ENABLE_AUTONOMY
 * release gate to be on.
 */
async function handle(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const governanceStatus = cronGovernanceStatus(header, CRON_SECRET, AUTONOMY_ENABLED);
  if (governanceStatus === 503)
    return error("Autonomous cron is disabled: CRON_SECRET is not configured.", 503);
  if (governanceStatus === 401) return error("Unauthorized", 401);
  if (governanceStatus === 423)
    return error("Autonomous operations are disabled by the release governance gate.", 423);

  const url = new URL(req.url);
  const agentParam = url.searchParams.get("agent") ?? url.searchParams.get("agents");
  const result = await runAutonomousTick({
    all: url.searchParams.get("all") === "1",
    agents: agentParam ? agentParam.split(",").map((a) => a.trim()).filter(Boolean) : undefined,
    includeIdle: url.searchParams.get("include_idle") === "1",
  });

  return json(result);
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
