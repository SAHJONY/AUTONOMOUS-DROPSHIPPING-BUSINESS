import { error, json, requireOrg } from "@/lib/api";
import { getAgent } from "@/lib/agents";
import { runAgent } from "@/lib/brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; agent: string }> },
) {
  const { orgId, agent } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  if (!getAgent(agent)) return error(`Unknown agent '${agent}'`, 404);

  const body = await req.json().catch(() => ({}));
  const task = String(body.task ?? "").trim();
  if (!task) return error("A task is required.", 422);

  const run = await runAgent({ orgId, agentName: agent, task });
  return json(run, 201);
}
