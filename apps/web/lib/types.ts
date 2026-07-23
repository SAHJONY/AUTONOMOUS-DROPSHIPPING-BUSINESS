export type Role = "owner" | "admin" | "member" | "viewer";

export type ProductStatus =
  | "discovered"
  | "analyzed"
  | "ready_to_launch"
  | "launched"
  | "killed";

export type RunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed";

export type ApprovalStatus = "pending" | "executing" | "approved" | "failed" | "rejected";

export interface User {
  id: string;
  email: string;
  full_name: string;
  hashed_password: string;
  is_active: boolean;
  is_owner: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Membership {
  org_id: string;
  role: Role;
}

export interface Store {
  id: string;
  org_id: string;
  name: string;
  platform: string;
  url: string;
  status: string;
  created_at: string;
}

export interface Product {
  id: string;
  org_id: string;
  title: string;
  description: string;
  source: string;
  supplier_url: string;
  cost: number;
  price: number;
  status: ProductStatus;
  score?: number;
  verdict?: string;
  storefront_url?: string;
  image_url?: string;
  image_source?: string; // "manual" | "source" | "higgsfield"
  video_url?: string;
  images?: string[];
  supplier?: string;
  shopify_id?: number; // numeric id of the live Shopify product (for image updates)
  shopify_handle?: string;
  created_at: string;
}

export interface AgentRun {
  id: string;
  org_id: string;
  agent_name: string;
  task: string;
  status: RunStatus;
  output: string;
  error: string;
  input_tokens: number;
  output_tokens: number;
  iterations: number;
  simulated: boolean;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  org_id: string;
  agent_run_id: string | null;
  agent_name: string;
  action: string;
  payload: Record<string, unknown>;
  risk_level: string;
  reason: string;
  status: ApprovalStatus;
  result: string;
  decided_by: string | null;
  created_at: string;
  decided_at: string | null;
  execution_token?: string | null;
  execution_started_at?: string | null;
  execution_failure?: string | null;
}

export interface ApprovalAuditEvent {
  id: string;
  org_id: string;
  request_id: string;
  actor_id: string;
  actor_role: Role | "system";
  action: string;
  previous_state: ApprovalStatus | null;
  next_state: ApprovalStatus;
  result: string;
  failure: string | null;
  execution_token: string | null;
  timestamp: string;
}

export interface MemoryEntry {
  id: string;
  org_id: string;
  agent_name: string;
  key: string;
  content: string;
  created_at: string;
}

export interface Dashboard {
  products_total: number;
  products_by_status: Record<string, number>;
  runs_total: number;
  runs_by_status: Record<string, number>;
  pending_approvals: number;
  stores_total: number;
  total_tokens_used: number;
  memory_entries: number;
  revenue_estimate: number;
  engine: string;
  engine_online: boolean;
  autopilot: boolean;
  auto_publish: boolean;
  autonomy_enabled: boolean;
  commerce_release_enabled: boolean;
  autonomy_pct: number;
}

export interface OrgSettings {
  autopilot: boolean;
  auto_publish: boolean;
}
