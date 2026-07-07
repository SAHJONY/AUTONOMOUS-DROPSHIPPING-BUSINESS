"""Business memory: per-organization notes that agents write and recall."""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import MemoryEntry


def remember(
    db: Session,
    org_id: str,
    key: str,
    content: str,
    agent_name: str = "",
) -> MemoryEntry:
    entry = MemoryEntry(org_id=org_id, agent_name=agent_name, key=key, content=content)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def recall(db: Session, org_id: str, query: str = "", limit: int = 20) -> list[MemoryEntry]:
    stmt = select(MemoryEntry).where(MemoryEntry.org_id == org_id)
    if query:
        pattern = f"%{query}%"
        stmt = stmt.where(
            or_(MemoryEntry.key.ilike(pattern), MemoryEntry.content.ilike(pattern))
        )
    stmt = stmt.order_by(MemoryEntry.created_at.desc()).limit(limit)
    return list(db.scalars(stmt))
