from typing import Annotated

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import Organization, OrgMembership, User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def get_org_for_user(
    org_id: Annotated[str, Path()],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Organization:
    membership = db.scalar(
        select(OrgMembership).where(
            OrgMembership.org_id == org_id, OrgMembership.user_id == user.id
        )
    )
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return membership.organization


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentOrg = Annotated[Organization, Depends(get_org_for_user)]
DB = Annotated[Session, Depends(get_db)]
