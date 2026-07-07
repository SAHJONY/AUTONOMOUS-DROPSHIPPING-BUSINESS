from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import DB, CurrentOrg
from app.models import AgentRun, ApprovalRequest, ApprovalStatus, Product, Store
from app.schemas import DashboardOut

router = APIRouter(prefix="/orgs/{org_id}", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(org: CurrentOrg, db: DB) -> DashboardOut:
    products_by_status = {
        k.value: v
        for k, v in db.execute(
            select(Product.status, func.count())
            .where(Product.org_id == org.id)
            .group_by(Product.status)
        ).all()
    }
    runs_by_status = {
        k.value: v
        for k, v in db.execute(
            select(AgentRun.status, func.count())
            .where(AgentRun.org_id == org.id)
            .group_by(AgentRun.status)
        ).all()
    }
    pending_approvals = db.scalar(
        select(func.count())
        .select_from(ApprovalRequest)
        .where(
            ApprovalRequest.org_id == org.id,
            ApprovalRequest.status == ApprovalStatus.pending,
        )
    )
    stores_total = db.scalar(
        select(func.count()).select_from(Store).where(Store.org_id == org.id)
    )
    tokens = db.execute(
        select(
            func.coalesce(func.sum(AgentRun.input_tokens), 0),
            func.coalesce(func.sum(AgentRun.output_tokens), 0),
        ).where(AgentRun.org_id == org.id)
    ).one()

    return DashboardOut(
        products_total=sum(products_by_status.values()),
        products_by_status=products_by_status,
        runs_total=sum(runs_by_status.values()),
        runs_by_status=runs_by_status,
        pending_approvals=pending_approvals or 0,
        stores_total=stores_total or 0,
        total_tokens_used=int(tokens[0]) + int(tokens[1]),
    )
