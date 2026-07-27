/**
 * The brain and engine: drives an agent through a manual tool-use loop with
 * approval gates, powered by the SAHJONY Autonomous Engine.
 *
 * A manual loop (rather than an auto tool runner) is deliberate: every tool
 * call passes through a policy check. Tools flagged `requires_approval` are
 * never executed by the model — an ApprovalRequest is created and the owner
 * decides. Approving it later executes the stored action.
 *
 * When no ANTHROPIC_API_KEY is configured the brain runs in deterministic
 * simulation mode so the platform is fully usable out of the box.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_MAX_ITERATIONS,
  AGENT_MAX_TOKENS,
  ANTHROPIC_API_KEY,
  BRAIN_MODEL,
  ENGINE_NAME,
} from "./config";
import { getAgent, OPERATING_DIRECTIVE, type Agent, type AgentContext, type ToolDef } from "./agents";
import {
  autoPublishReady,
  appendApprovalAudit,
  claimApproval,
  finalizeApproval,
  getOrgSettings,
  isAutoApprovable,
  listApprovals,
  newId,
  nowISO,
  remember,
  saveApproval,
  saveRun,
  updateRun,
} from "./store";
import type { AgentRun, ApprovalRequest, Role } from "./types";

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  anthropic ??= new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return anthropic;
}

async function queueApproval(
  agent: Agent,
  tool: ToolDef,
  payload: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ApprovalRequest> {
  const approval: ApprovalRequest = {
    id: newId(),
    org_id: ctx.orgId,
    agent_run_id: ctx.runId,
    agent_name: agent.name,
    action: tool.name,
    payload,
    risk_level: tool.risk_level ?? "high",
    reason: `Agent '${agent.name}' requested: ${JSON.stringify(payload).slice(0, 500)}`,
    status: "pending",
    result: "",
    decided_by: null,
    created_at: nowISO(),
    decided_at: null,
  };
  await saveApproval(approval);
  return approval;
}

interface RunOptions {
  orgId: string;
  agentName: string;
  task: string;
  depth?: number;
}

export async function runAgent(opts: RunOptions): Promise<AgentRun> {
  const agent = getAgent(opts.agentName);
  const run: AgentRun = {
    id: newId(),
    org_id: opts.orgId,
    agent_name: opts.agentName,
    task: opts.task,
    status: "running",
    output: "",
    error: "",
    input_tokens: 0,
    output_tokens: 0,
    iterations: 0,
    simulated: !ANTHROPIC_API_KEY,
    created_at: nowISO(),
  };
  await saveRun(run);

  if (!agent) {
    const patch = { status: "failed" as const, error: `Unknown agent '${opts.agentName}'.` };
    await updateRun(opts.orgId, run.id, patch);
    return { ...run, ...patch };
  }

  const ctx: AgentContext = { orgId: opts.orgId, depth: opts.depth ?? 0, runId: run.id };

  try {
    const result = ANTHROPIC_API_KEY
      ? await runLive(agent, opts.task, ctx)
      : await runSimulated(agent, opts.task, ctx);
    const patch = {
      status: result.status,
      output: result.output,
      iterations: result.iterations,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
    };
    await updateRun(opts.orgId, run.id, patch);
    // Zero-click storefront: after product discovery, auto-publish launch-ready
    // products (with cinematic imagery) to the connected Shopify store.
    if (opts.agentName === "product_hunter" || opts.agentName === "ceo") {
      try {
        await autoPublishReady(opts.orgId);
      } catch {
        /* non-fatal */
      }
    }
    return { ...run, ...patch };
  } catch (err) {
    const patch = {
      status: "failed" as const,
      error: `${(err as Error).name}: ${(err as Error).message}`,
    };
    await updateRun(opts.orgId, run.id, patch);
    return { ...run, ...patch };
  }
}

interface LoopResult {
  status: AgentRun["status"];
  output: string;
  iterations: number;
  input_tokens: number;
  output_tokens: number;
}

/* ---------- live loop (SAHJONY engine) ---------- */

async function runLive(agent: Agent, task: string, ctx: AgentContext): Promise<LoopResult> {
  const tools = agent.tools();
  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const apiTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];
  let inputTokens = 0;
  let outputTokens = 0;
  const pendingApprovals: string[] = [];
  const settings = await getOrgSettings(ctx.orgId);

  for (let iteration = 1; iteration <= AGENT_MAX_ITERATIONS; iteration++) {
    const response = await client().messages.create({
      model: BRAIN_MODEL,
      max_tokens: AGENT_MAX_TOKENS,
      system: `${OPERATING_DIRECTIVE}\n\n${agent.system_prompt}`,
      tools: apiTools,
      messages,
    });
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason !== "tool_use") {
      const finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return {
        status: pendingApprovals.length ? "awaiting_approval" : "completed",
        output: finalText,
        iterations: iteration,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      };
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const tool = toolsByName.get(block.name);
      let content: string;
      let isError = false;
      if (!tool) {
        content = `Error: unknown tool '${block.name}'.`;
        isError = true;
      } else if (tool.requires_approval) {
        const payload = block.input as Record<string, unknown>;
        if (settings.autopilot && isAutoApprovable(tool.name, payload)) {
          // Autopilot: execute now and log an auto-approved record for the audit trail.
          try {
            const result = await tool.handler(ctx, payload);
            const approval: ApprovalRequest = {
              id: newId(),
              org_id: ctx.orgId,
              agent_run_id: ctx.runId,
              agent_name: agent.name,
              action: tool.name,
              payload,
              risk_level: tool.risk_level ?? "high",
              reason: `Autopilot auto-approved: ${JSON.stringify(payload).slice(0, 400)}`,
              status: "approved",
              result,
              decided_by: "autopilot",
              created_at: nowISO(),
              decided_at: nowISO(),
            };
            await saveApproval(approval);
            content = `Autopilot approved and executed '${tool.name}'. Result: ${result}`;
          } catch (e) {
            content = `Tool error: ${(e as Error).message}`;
            isError = true;
          }
        } else {
          const approval = await queueApproval(agent, tool, payload, ctx);
          pendingApprovals.push(approval.id);
          content =
            `Action '${tool.name}' exceeds the autopilot safety threshold and was queued for owner ` +
            `approval (approval id ${approval.id}). It has NOT been executed. Continue with the rest ` +
            `of the task and mention the pending approval in your summary.`;
        }
      } else {
        try {
          content = await tool.handler(ctx, block.input as Record<string, unknown>);
        } catch (e) {
          content = `Tool error: ${(e as Error).message}`;
          isError = true;
        }
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content,
        is_error: isError,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    status: "failed",
    output: "Agent stopped: maximum iterations reached without completing the task.",
    iterations: AGENT_MAX_ITERATIONS,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}

/* ---------- simulation loop (no API key) ---------- */

async function runSimulated(agent: Agent, task: string, ctx: AgentContext): Promise<LoopResult> {
  // Exercise read/snapshot tools so the operator sees real data, then file a
  // structured note. High-risk tools are still gated for realism.
  const tools = agent.tools();
  const lines: string[] = [];
  let pending = false;

  const snapshot = tools.find((t) => t.name === "get_business_snapshot");
  if (snapshot) lines.push(`Snapshot: ${await snapshot.handler(ctx, {})}`);
  const listP = tools.find((t) => t.name === "list_products");
  if (listP) lines.push(`Catalog: ${await listP.handler(ctx, {})}`);

  const summary =
    `[${ENGINE_NAME} — standby mode]\n` +
    `${agent.name.replace(/_/g, " ").toUpperCase()} received task: "${task}".\n` +
    (lines.length ? lines.join("\n") + "\n" : "") +
    `Planned next actions logged to business memory. High-risk actions would be queued for your approval.`;

  await remember(ctx.orgId, `${agent.name}-plan`, summary, agent.name);

  return {
    status: pending ? "awaiting_approval" : "completed",
    output: summary,
    iterations: 1,
    input_tokens: 0,
    output_tokens: 0,
  };
}

/* ---------- approval execution ---------- */

/**
 * Autopilot sweep: auto-approve every pending action that's within the safety
 * thresholds. Called by the 24/7 cron so the queue clears itself, leaving only
 * the ~2% that genuinely needs the owner.
 */
export async function autoApprovePending(orgId: string): Promise<number> {
  const settings = await getOrgSettings(orgId);
  if (!settings.autopilot) return 0;
  const pending = (await listApprovals(orgId)).filter((a) => a.status === "pending");
  let approved = 0;
  for (const a of pending) {
    if (isAutoApprovable(a.action, a.payload)) {
      try {
        await decideApproval(orgId, a.id, "approve", "autopilot", "owner");
        approved++;
      } catch {
        /* skip on error */
      }
    }
  }
  return approved;
}

export async function decideApproval(
  orgId: string,
  approvalId: string,
  decision: "approve" | "reject",
  userId: string,
  actorRole: Role,
  reason = "",
): Promise<ApprovalRequest> {
  const { approval, executionToken } = await claimApproval(
    orgId,
    approvalId,
    userId,
    actorRole,
  );

  if (decision === "approve") {
    try {
      const agent = getAgent(approval.agent_name);
      const tool = agent?.tools().find((t) => t.name === approval.action);
      if (!tool) throw new Error(`Action '${approval.action}' is no longer available.`);
      const ctx: AgentContext = { orgId, depth: 0, runId: approval.agent_run_id };
      const result = await tool.handler(ctx, approval.payload);
      const finalized = await finalizeApproval(orgId, approvalId, executionToken, {
        status: "approved",
        result,
        decided_by: userId,
        decided_at: nowISO(),
      });
      await appendApprovalAudit({
        orgId,
        requestId: approvalId,
        actorId: userId,
        actorRole,
        action: approval.action,
        previousState: "executing",
        nextState: "approved",
        result: "executed",
        executionToken,
      });
      return finalized;
    } catch (cause) {
      const failure = (cause as Error).message;
      await finalizeApproval(orgId, approvalId, executionToken, {
        status: "failed",
        result: "",
        execution_failure: failure,
        decided_by: userId,
        decided_at: nowISO(),
      });
      await appendApprovalAudit({
        orgId,
        requestId: approvalId,
        actorId: userId,
        actorRole,
        action: approval.action,
        previousState: "executing",
        nextState: "failed",
        result: "failed",
        failure,
        executionToken,
      });
      throw cause;
    }
  }

  const finalized = await finalizeApproval(orgId, approvalId, executionToken, {
    status: "rejected",
    result: reason || "Rejected by the owner.",
    decided_by: userId,
    decided_at: nowISO(),
  });
  await appendApprovalAudit({
    orgId,
    requestId: approvalId,
    actorId: userId,
    actorRole,
    action: approval.action,
    previousState: "executing",
    nextState: "rejected",
    result: "rejected",
    executionToken,
  });
  return finalized;
}
