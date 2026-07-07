from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.agents.base import AgentContext, AgentRunnerError
from app.agents.orchestrator import REGISTRY, run_agent
from app.api.deps import DB, CurrentOrg
from app.models import AgentRun, RunStatus
from app.schemas import AgentInfo, AgentRunOut, AgentRunRequest

router = APIRouter(tags=["agents"])


@router.get("/agents", response_model=list[AgentInfo])
def list_agents(db: DB) -> list[AgentInfo]:
    infos = []
    ctx = AgentContext(db=db, org_id="__introspection__")
    for agent in REGISTRY.values():
        tools = agent.get_tools(ctx)
        infos.append(
            AgentInfo(
                name=agent.name,
                description=agent.description,
                tools=[t.name for t in tools],
                high_risk_tools=[t.name for t in tools if t.requires_approval],
            )
        )
    return infos


@router.post(
    "/orgs/{org_id}/agents/{agent_name}/run",
    response_model=AgentRunOut,
    status_code=status.HTTP_201_CREATED,
)
def run_agent_endpoint(agent_name: str, body: AgentRunRequest, org: CurrentOrg, db: DB) -> AgentRun:
    if agent_name not in REGISTRY:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown agent '{agent_name}'")
    try:
        run = run_agent(db, org_id=org.id, agent_name=agent_name, task=body.task)
    except AgentRunnerError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    if run.status == RunStatus.failed and "ANTHROPIC_API_KEY" in run.error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, run.error)
    return run


@router.get("/orgs/{org_id}/runs", response_model=list[AgentRunOut])
def list_runs(org: CurrentOrg, db: DB) -> list[AgentRun]:
    return list(
        db.scalars(
            select(AgentRun)
            .where(AgentRun.org_id == org.id)
            .order_by(AgentRun.created_at.desc())
            .limit(100)
        )
    )


@router.get("/orgs/{org_id}/runs/{run_id}", response_model=AgentRunOut)
def get_run(run_id: str, org: CurrentOrg, db: DB) -> AgentRun:
    run = db.get(AgentRun, run_id)
    if run is None or run.org_id != org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    return run
