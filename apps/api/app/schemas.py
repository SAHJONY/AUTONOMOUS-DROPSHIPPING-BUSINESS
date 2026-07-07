from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ApprovalStatus, ProductStatus, RunStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth ---


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = ""
    organization_name: str = "My Business"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: str
    email: EmailStr
    full_name: str
    is_active: bool


# --- Organizations ---


class OrganizationOut(ORMModel):
    id: str
    name: str
    created_at: datetime


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


# --- Products ---


class ProductOut(ORMModel):
    id: str
    title: str
    description: str
    source: str
    supplier_url: str
    cost: float
    price: float
    status: ProductStatus
    created_at: datetime


class ProductCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = ""
    source: str = "manual"
    supplier_url: str = ""
    cost: float = 0.0
    price: float = 0.0


class ScoreRequest(BaseModel):
    demand: float = Field(ge=0, le=100)
    competition: float = Field(ge=0, le=100)
    margin: float = Field(ge=0, le=100)
    trend: float = Field(ge=0, le=100)
    risk: float = Field(ge=0, le=100)


class ScoreResponse(BaseModel):
    demand: float
    competition: float
    margin: float
    trend: float
    risk: float
    total_score: float
    verdict: str
    rationale: str


class ProductAnalysisOut(ORMModel):
    id: str
    product_id: str
    demand: float
    competition: float
    margin: float
    trend: float
    risk: float
    total_score: float
    verdict: str
    rationale: str
    created_at: datetime


# --- Agents ---


class AgentInfo(BaseModel):
    name: str
    description: str
    tools: list[str]
    high_risk_tools: list[str]


class AgentRunRequest(BaseModel):
    task: str = Field(min_length=1)


class AgentRunOut(ORMModel):
    id: str
    agent_name: str
    task: str
    status: RunStatus
    output: str
    error: str
    input_tokens: int
    output_tokens: int
    iterations: int
    created_at: datetime
    updated_at: datetime


# --- Approvals ---


class ApprovalOut(ORMModel):
    id: str
    agent_run_id: str | None
    agent_name: str
    action: str
    payload: dict
    risk_level: str
    reason: str
    status: ApprovalStatus
    result: str
    created_at: datetime
    decided_at: datetime | None


class ApprovalDecision(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    reason: str = ""


# --- Dashboard ---


class DashboardOut(BaseModel):
    products_total: int
    products_by_status: dict[str, int]
    runs_total: int
    runs_by_status: dict[str, int]
    pending_approvals: int
    stores_total: int
    total_tokens_used: int
