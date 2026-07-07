from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.agents.orchestrator import execute_approved_action, reject_action
from app.api.deps import DB, CurrentOrg, CurrentUser
from app.models import ApprovalRequest, ApprovalStatus
from app.schemas import ApprovalDecision, ApprovalOut

router = APIRouter(prefix="/orgs/{org_id}/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalOut])
def list_approvals(
    org: CurrentOrg, db: DB, status_filter: ApprovalStatus | None = None
) -> list[ApprovalRequest]:
    stmt = select(ApprovalRequest).where(ApprovalRequest.org_id == org.id)
    if status_filter is not None:
        stmt = stmt.where(ApprovalRequest.status == status_filter)
    return list(db.scalars(stmt.order_by(ApprovalRequest.created_at.desc())))


@router.post("/{approval_id}/decide", response_model=ApprovalOut)
def decide(
    approval_id: str,
    body: ApprovalDecision,
    org: CurrentOrg,
    user: CurrentUser,
    db: DB,
) -> ApprovalRequest:
    approval = db.get(ApprovalRequest, approval_id)
    if approval is None or approval.org_id != org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Approval request not found")
    try:
        if body.decision == "approve":
            execute_approved_action(db, approval, decided_by=user.id)
        else:
            reject_action(db, approval, decided_by=user.id, reason=body.reason)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    db.refresh(approval)
    return approval
