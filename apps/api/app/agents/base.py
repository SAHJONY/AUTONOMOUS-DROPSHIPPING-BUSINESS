"""Agent SDK: tool definitions, agent base class, and the approval-gated runner.

A manual agentic loop (rather than the SDK tool runner) is used deliberately:
every tool call passes through a policy check, and tools flagged
``requires_approval`` are never executed directly by the model. Instead an
``ApprovalRequest`` row is created and the agent is told the action is queued
for a human decision. Approving the request later executes the stored action.
"""

import json
from collections.abc import Callable
from dataclasses import dataclass, field

import anthropic
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AgentRun, ApprovalRequest, RunStatus


@dataclass
class AgentContext:
    db: Session
    org_id: str
    run: AgentRun | None = None
    # Depth guard so the CEO can dispatch sub-agents without infinite recursion.
    depth: int = 0


@dataclass
class ToolDef:
    name: str
    description: str
    input_schema: dict
    handler: Callable[[AgentContext, dict], str]
    requires_approval: bool = False
    risk_level: str = "low"

    def to_api_schema(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


@dataclass
class AgentResult:
    status: RunStatus
    output: str
    iterations: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    pending_approvals: list[str] = field(default_factory=list)


class BaseAgent:
    name: str = "base"
    description: str = ""
    system_prompt: str = ""

    def get_tools(self, ctx: AgentContext) -> list[ToolDef]:  # pragma: no cover - interface
        return []

    def get_tool(self, ctx: AgentContext, tool_name: str) -> ToolDef | None:
        for tool in self.get_tools(ctx):
            if tool.name == tool_name:
                return tool
        return None


class AgentRunnerError(RuntimeError):
    pass


def build_client() -> anthropic.Anthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise AgentRunnerError(
            "ANTHROPIC_API_KEY is not configured; live agent runs are disabled."
        )
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


class AgentRunner:
    """Drives one agent through a manual tool-use loop with approval gates."""

    def __init__(self, client: anthropic.Anthropic | None = None):
        self.client = client or build_client()

    def run(self, agent: BaseAgent, task: str, ctx: AgentContext) -> AgentResult:
        settings = get_settings()
        tools = agent.get_tools(ctx)
        tool_schemas = [t.to_api_schema() for t in tools]
        tools_by_name = {t.name: t for t in tools}

        messages: list[dict] = [{"role": "user", "content": task}]
        input_tokens = 0
        output_tokens = 0
        pending_approvals: list[str] = []

        for iteration in range(1, settings.agent_max_iterations + 1):
            response = self.client.messages.create(
                model=settings.anthropic_model,
                max_tokens=settings.agent_max_tokens,
                system=agent.system_prompt,
                thinking={"type": "adaptive"},
                tools=tool_schemas,
                messages=messages,
            )
            input_tokens += response.usage.input_tokens
            output_tokens += response.usage.output_tokens

            if response.stop_reason == "refusal":
                return AgentResult(
                    status=RunStatus.failed,
                    output="The model declined this request.",
                    iterations=iteration,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )

            if response.stop_reason == "pause_turn":
                messages.append({"role": "assistant", "content": response.content})
                continue

            if response.stop_reason != "tool_use":
                final_text = "\n".join(
                    block.text for block in response.content if block.type == "text"
                )
                status = (
                    RunStatus.awaiting_approval if pending_approvals else RunStatus.completed
                )
                return AgentResult(
                    status=status,
                    output=final_text,
                    iterations=iteration,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    pending_approvals=pending_approvals,
                )

            # Tool use: execute (or gate) every requested tool, then continue the loop.
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                tool = tools_by_name.get(block.name)
                if tool is None:
                    result_text = f"Error: unknown tool '{block.name}'."
                    is_error = True
                elif tool.requires_approval:
                    approval = self._queue_approval(agent, tool, dict(block.input), ctx)
                    pending_approvals.append(approval.id)
                    result_text = (
                        f"Action '{tool.name}' is {tool.risk_level}-risk and was queued for "
                        f"human approval (approval id {approval.id}). It has NOT been executed. "
                        "Continue with the rest of the task and mention the pending approval "
                        "in your summary."
                    )
                    is_error = False
                else:
                    try:
                        result_text = tool.handler(ctx, dict(block.input))
                        is_error = False
                    except Exception as exc:  # surface tool failures to the model
                        result_text = f"Tool error: {exc}"
                        is_error = True
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_text,
                        "is_error": is_error,
                    }
                )
            messages.append({"role": "user", "content": tool_results})

        return AgentResult(
            status=RunStatus.failed,
            output="Agent stopped: maximum iterations reached without completing the task.",
            iterations=settings.agent_max_iterations,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            pending_approvals=pending_approvals,
        )

    def _queue_approval(
        self, agent: BaseAgent, tool: ToolDef, payload: dict, ctx: AgentContext
    ) -> ApprovalRequest:
        approval = ApprovalRequest(
            org_id=ctx.org_id,
            agent_run_id=ctx.run.id if ctx.run else None,
            agent_name=agent.name,
            action=tool.name,
            payload=payload,
            risk_level=tool.risk_level,
            reason=f"Agent '{agent.name}' requested: {json.dumps(payload)[:500]}",
        )
        ctx.db.add(approval)
        ctx.db.commit()
        ctx.db.refresh(approval)
        return approval
