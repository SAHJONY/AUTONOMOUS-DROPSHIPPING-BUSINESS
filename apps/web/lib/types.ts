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

/**
 * Where an order sits in the dropshipping pipeline. This is *our* state, not
 * Shopify's: it tracks the supplier leg (placing the order at CJ, waiting for a
 * tracking number) that Shopify knows nothing about until we push a fulfillment.
 */
export type OrderStage =
  | "received" // paid, nothing done yet
  | "awaiting_stock" // placed at supplier, no tracking yet
  | "shipped" // tracking number pushed to Shopify
  | "delivered"
  | "cancelled"
  | "refunded"
  | "on_hold"; // needs a human: unmapped SKU, failed placement, high risk

/** Accounts in the single-entry cash ledger. Signs are normalized on posting. */
export type LedgerAccount =
  | "revenue" // product sales (money in)
  | "shipping_income" // shipping charged to the customer (money in)
  | "tax" // sales tax collected — held, not income
  | "discount" // promo given away (money out)
  | "cogs" // what the supplier charged for goods (money out)
  | "supplier_shipping" // what the supplier charged to ship (money out)
  | "payment_fees" // processor fees (money out)
  | "refunds" // money returned to customers (money out)
  | "ad_spend" // marketing (money out)
  | "opex"; // platform/tooling (money out)

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
  shopify_variant_id?: number; // the variant customers actually buy — links orders back to this product
  sku?: string;
  /** Native inventory. Undefined means inventory is not tracked for this item. */
  inventory_quantity?: number;
  inventory_policy?: "deny" | "continue";
  supplier_pid?: string; // supplier's product id (CJ pid) — needed to place orders
  supplier_vid?: string; // supplier's variant id (CJ vid) — what actually gets ordered
  created_at: string;
}

/** One line of a customer order, resolved against our catalog where possible. */
export interface OrderLine {
  sku: string;
  title: string;
  quantity: number;
  unit_price: number;
  /** Our catalog product id, when the line could be matched. Null means unmapped. */
  product_id: string | null;
  shopify_variant_id?: number;
  supplier_pid?: string;
  supplier_vid?: string;
  /** Per-unit supplier cost at the time of sale (frozen — catalog prices move). */
  unit_cost: number;
}

export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  province_code: string;
  zip: string;
  country: string;
  country_code: string;
}

export interface OrderEvent {
  at: string;
  kind: string;
  detail: string;
}

export interface Order {
  id: string;
  org_id: string;
  channel: "shopify" | "native" | "manual";
  /** Shopify's numeric order id as a string. Unique per org — the dedupe key. */
  external_id: string;
  order_number: string;
  email: string;
  customer_name: string;
  currency: string;

  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;

  /** Shopify's own words, kept for reconciliation. */
  financial_status: string;
  fulfillment_status: string;

  stage: OrderStage;
  lines: OrderLine[];
  shipping_address: ShippingAddress;

  /** Supplier leg. */
  supplier: string;
  supplier_order_id?: string;
  supplier_order_number?: string;
  cogs: number;
  supplier_shipping: number;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;

  refunded: number;
  hold_reason?: string;
  events: OrderEvent[];

  placed_at: string;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  org_id: string;
  account: LedgerAccount;
  /** Signed: positive is money in, negative is money out. */
  amount: number;
  currency: string;
  order_id?: string;
  product_id?: string;
  /** Units sold, on revenue entries — lets the P&L report volume without the orders list. */
  units?: number;
  memo: string;
  /** Stable key that makes posting idempotent across retries and replays. */
  dedupe_key: string;
  occurred_at: string;
  created_at: string;
}

export interface ProfitAndLoss {
  period: { key: string; label: string; from: string; to: string };
  orders: number;
  units: number;
  gross_revenue: number;
  shipping_income: number;
  discounts: number;
  refunds: number;
  net_revenue: number;
  cogs: number;
  supplier_shipping: number;
  payment_fees: number;
  gross_profit: number;
  ad_spend: number;
  opex: number;
  net_profit: number;
  gross_margin_pct: number;
  net_margin_pct: number;
  aov: number;
  profit_per_order: number;
  tax_collected: number;
  by_account: Record<string, number>;
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
  /** Catalog-derived potential (per-unit margin of launched products). */
  revenue_estimate: number;
  /** Real money, from real orders. */
  orders_total: number;
  orders_awaiting_fulfillment: number;
  orders_on_hold: number;
  /** Cancelled/refunded orders whose goods we already paid the supplier for. */
  supplier_exposure_count: number;
  supplier_exposure_value: number;
  revenue_30d: number;
  net_profit_30d: number;
  net_margin_30d: number;
  aov_30d: number;
  engine: string;
  engine_online: boolean;
  autopilot: boolean;
  auto_publish: boolean;
  auto_fulfill: boolean;
  autonomy_enabled: boolean;
  commerce_release_enabled: boolean;
  autonomy_pct: number;
}

export interface OrgSettings {
  autopilot: boolean;
  auto_publish: boolean;
  /** Place paid orders with the supplier automatically (within the cost cap). */
  auto_fulfill: boolean;
}
