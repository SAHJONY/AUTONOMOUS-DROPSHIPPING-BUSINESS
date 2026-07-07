import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(UTC)


class MembershipRole(enum.StrEnum):
    owner = "owner"
    admin = "admin"
    member = "member"


class ProductStatus(enum.StrEnum):
    discovered = "discovered"
    analyzed = "analyzed"
    ready_to_launch = "ready_to_launch"
    launched = "launched"
    killed = "killed"


class RunStatus(enum.StrEnum):
    pending = "pending"
    running = "running"
    awaiting_approval = "awaiting_approval"
    completed = "completed"
    failed = "failed"


class ApprovalStatus(enum.StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    memberships: Mapped[list["OrgMembership"]] = relationship(back_populates="user")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    memberships: Mapped[list["OrgMembership"]] = relationship(back_populates="organization")


class OrgMembership(Base):
    __tablename__ = "org_memberships"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    role: Mapped[MembershipRole] = mapped_column(Enum(MembershipRole), default=MembershipRole.owner)

    user: Mapped[User] = relationship(back_populates="memberships")
    organization: Mapped[Organization] = relationship(back_populates="memberships")


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    platform: Mapped[str] = mapped_column(String(50), default="shopify")
    url: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(50), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    store_id: Mapped[str | None] = mapped_column(ForeignKey("stores.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(100), default="manual")
    supplier_url: Mapped[str] = mapped_column(String(1000), default="")
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus), default=ProductStatus.discovered
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    analyses: Mapped[list["ProductAnalysis"]] = relationship(back_populates="product")


class ProductAnalysis(Base):
    __tablename__ = "product_analyses"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    demand: Mapped[float] = mapped_column(Float)
    competition: Mapped[float] = mapped_column(Float)
    margin: Mapped[float] = mapped_column(Float)
    trend: Mapped[float] = mapped_column(Float)
    risk: Mapped[float] = mapped_column(Float)
    total_score: Mapped[float] = mapped_column(Float)
    verdict: Mapped[str] = mapped_column(String(50))
    rationale: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    product: Mapped[Product] = relationship(back_populates="analyses")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    agent_name: Mapped[str] = mapped_column(String(100), index=True)
    task: Mapped[str] = mapped_column(Text)
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus), default=RunStatus.pending)
    output: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    iterations: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    approvals: Mapped[list["ApprovalRequest"]] = relationship(back_populates="agent_run")


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    agent_run_id: Mapped[str | None] = mapped_column(ForeignKey("agent_runs.id"), nullable=True)
    agent_name: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    risk_level: Mapped[str] = mapped_column(String(20), default="high")
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus), default=ApprovalStatus.pending
    )
    result: Mapped[str] = mapped_column(Text, default="")
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    agent_run: Mapped[AgentRun | None] = relationship(back_populates="approvals")


class MemoryEntry(Base):
    __tablename__ = "memory_entries"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    agent_name: Mapped[str] = mapped_column(String(100), default="", index=True)
    key: Mapped[str] = mapped_column(String(255), index=True)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
