from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.deps import DB, CurrentOrg, CurrentUser
from app.models import MembershipRole, Organization, OrgMembership
from app.schemas import OrganizationCreate, OrganizationOut

router = APIRouter(prefix="/orgs", tags=["organizations"])


@router.get("", response_model=list[OrganizationOut])
def list_orgs(user: CurrentUser, db: DB) -> list[Organization]:
    return list(
        db.scalars(
            select(Organization)
            .join(OrgMembership, OrgMembership.org_id == Organization.id)
            .where(OrgMembership.user_id == user.id)
        )
    )


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_org(body: OrganizationCreate, user: CurrentUser, db: DB) -> Organization:
    org = Organization(name=body.name)
    db.add(org)
    db.flush()
    db.add(OrgMembership(user_id=user.id, org_id=org.id, role=MembershipRole.owner))
    db.commit()
    db.refresh(org)
    return org


@router.get("/{org_id}", response_model=OrganizationOut)
def get_org(org: CurrentOrg) -> Organization:
    return org
