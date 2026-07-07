"""Orchestrator: agent registry, run lifecycle, and approved-action execution."""

import anthropic
from sqlalchemy.orm import Session

from app.agents.base import AgentContext, AgentRunner, AgentRunnerError, BaseAgent
from app.agents.roster import ALL_AGENTS
from app.models import AgentRun, ApprovalRequest, ApprovalStatus, RunStatus, utcnow

REGISTRY: dict[str, BaseAgent] = {agent.name: agent for agent in ALL_AGENTS}


def get_agent(name: str) -> BaseAgent:
    agent = REGISTRY.get(name)
    if agent is None:
        raise KeyError(f"Unknown agent '{name}'. Available: {', '.join(sorted(REGISTRY))}")
    return agent


def run_agent(
    db: Session,
    org_id: str,
    agent_name: str,
    task: str,
    depth: int = 0,
    client: anthropic.Anthropic | None = None,
) -> AgentRun:
    agent = get_agent(agent_name)

    run = AgentRun(org_id=org_id, agent_name=agent_name, task=task, status=RunStatus.running)
    db.add(run)
    db.commit()
    db.refresh(run)

    ctx = AgentContext(db=db, org_id=org_id, run=run, depth=depth)
    try:
        runner = AgentRunner(client=client)
        result = runner.run(agent, task, ctx)
        run.status = result.status
        run.output = result.output
        run.iterations = result.iterations
        run.input_tokens = result.input_tokens
        run.output_tokens = result.output_tokens
    except AgentRunnerError as exc:
        run.status = RunStatus.failed
        run.error = str(exc)
    except Exception as exc:  # keep the run record consistent on unexpected errors
        run.status = RunStatus.failed
        run.error = f"{type(exc).__name__}: {exc}"
    db.commit()
    db.refresh(run)
    return run


def execute_approved_action(db: Session, approval: ApprovalRequest, decided_by: str) -> str:
    """Execute the tool call stored in an approved ApprovalRequest."""
    if approval.status != ApprovalStatus.pending:
        raise ValueError("Approval request has already been decided.")

    agent = get_agent(approval.agent_name)
    ctx = AgentContext(db=db, org_id=approval.org_id)
    tool = agent.get_tool(ctx, approval.action)
    if tool is None:
        raise ValueError(f"Action '{approval.action}' is no longer available.")

    result = tool.handler(ctx, dict(approval.payload))

    approval.status = ApprovalStatus.approved
    approval.result = result
    approval.decided_by = decided_by
    approval.decided_at = utcnow()
    _maybe_resolve_run(db, approval)
    db.commit()
    return result


def reject_action(
    db: Session, approval: ApprovalRequest, decided_by: str, reason: str = ""
) -> None:
    if approval.status != ApprovalStatus.pending:
        raise ValueError("Approval request has already been decided.")
    approval.status = ApprovalStatus.rejected
    approval.result = reason or "Rejected by human reviewer."
    approval.decided_by = decided_by
    approval.decided_at = utcnow()
    _maybe_resolve_run(db, approval)
    db.commit()


def _maybe_resolve_run(db: Session, approval: ApprovalRequest) -> None:
    """Mark the originating run completed once no approvals remain pending."""
    run = approval.agent_run
    if run is None or run.status != RunStatus.awaiting_approval:
        return
    still_pending = any(
        a.status == ApprovalStatus.pending and a.id != approval.id for a in run.approvals
    )
    if not still_pending:
        run.status = RunStatus.completed
