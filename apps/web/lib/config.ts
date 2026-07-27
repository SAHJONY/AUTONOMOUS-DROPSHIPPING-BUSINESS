/**
 * Central configuration for SAHJONY Commerce (Vercel-native).
 *
 * The app runs entirely on Vercel: Next.js route handlers are the backend,
 * Upstash Redis (with an in-memory fallback) is the datastore, and the SAHJONY Autonomous Engine
 * is the brain behind every autonomous decision.
 */

/** Brand identity. The engine internals are never exposed to end users. */
export const BRAND = "SAHJONY";
export const BRAND_DOMAIN = "sahjony.com";
export const PRODUCT_NAME = "SAHJONY Commerce";
export const ENGINE_NAME = "SAHJONY Autonomous Engine";

/** The unrestricted super-admin / owner of this deployment. */
export const OWNER_EMAIL = "sahjonycapitalllc@outlook.com";

/** Model that powers the autonomous engine (internal — never surfaced to users). */
export const BRAIN_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-fable-5";

/** Product opportunity launch threshold (0-100). Only 85+ ships. */
export const LAUNCH_SCORE_THRESHOLD = Number(
  process.env.LAUNCH_SCORE_THRESHOLD ?? 85,
);

/** JWT signing secret. MUST be set in production. */
export const JWT_SECRET =
  process.env.JWT_SECRET ??
  process.env.SECRET_KEY ??
  "change-me-in-production-commerce-os";

/** Token lifetime, in seconds (default 7 days). */
export const TOKEN_TTL_SECONDS = Number(
  process.env.TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7,
);

/** Secret that authorizes the 24/7 autonomous cron endpoint. */
export const CRON_SECRET = process.env.CRON_SECRET ?? "";

/** Engine key — when absent the engine runs in deterministic standby mode. */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

/**
 * Owner bootstrap password, set in Vercel env. When present, the owner account
 * (OWNER_EMAIL) is auto-provisioned and this value is the authoritative password:
 * signing in as the owner with it always works and re-syncs the stored hash.
 */
export const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? "";

export const AGENT_MAX_ITERATIONS = Number(
  process.env.AGENT_MAX_ITERATIONS ?? 12,
);
export const AGENT_MAX_TOKENS = Number(process.env.AGENT_MAX_TOKENS ?? 16000);

/**
 * Autopilot — targets ~98% autonomy. When on, the engine auto-approves routine
 * gated actions within safe thresholds and only escalates genuinely large or
 * risky ones (big ad budgets, big refunds) to the owner. Default ON.
 */
export const AUTOPILOT_DEFAULT = (process.env.AUTOPILOT ?? "false") === "true";
/** Master release gate. Keep false until security, commerce and accounting gates pass. */
export const AUTONOMY_ENABLED = process.env.ENABLE_AUTONOMY === "true";
/** Hard server-side publishing gate. PR B owns enabling this safely. */
export const COMMERCE_RELEASE_ENABLED = process.env.COMMERCE_RELEASE_ENABLED === "true";

/** Ad budgets at/below this ($/day) auto-approve; above it, the owner decides. */
export const AUTOPILOT_MAX_AD_BUDGET = Number(process.env.AUTOPILOT_MAX_AD_BUDGET ?? 50);
/** Refunds at/below this ($) auto-approve; above it, the owner decides. */
export const AUTOPILOT_MAX_REFUND = Number(process.env.AUTOPILOT_MAX_REFUND ?? 50);
/**
 * Supplier orders costing at/below this ($) are placed automatically. Above it,
 * the owner approves before any money leaves the account. This is the single
 * most important safety valve in the system: it is the only autonomous action
 * that spends real cash on an external platform.
 */
export const AUTOPILOT_MAX_ORDER_COST = Number(process.env.AUTOPILOT_MAX_ORDER_COST ?? 150);

/**
 * Fulfil paid orders at the supplier without being asked. Fail-closed, in line
 * with the master release gates: this is the one loop that spends real cash on
 * an external platform, so it stays off until the owner turns it on.
 */
export const AUTO_FULFILL_DEFAULT = process.env.AUTO_FULFILL === "true";

/**
 * An order is held for review rather than auto-placed when Shopify flags it as
 * high fraud risk. Shopify's recommendation values are "accept" | "investigate" | "cancel".
 */
export const HOLD_RISKY_ORDERS = (process.env.HOLD_RISKY_ORDERS ?? "true") !== "false";

/* --- Payment processing cost model ------------------------------------------
 * Shopify's order payload does not carry the processing fee, so the books model
 * it at the standard online card rate (2.9% + $0.30). Override per deployment to
 * match your actual processor agreement.
 */
export const PAYMENT_FEE_RATE = Number(process.env.PAYMENT_FEE_RATE ?? 0.029);
export const PAYMENT_FEE_FIXED = Number(process.env.PAYMENT_FEE_FIXED ?? 0.3);

/**
 * Shared secret Shopify signs webhooks with (the app's client secret, or the
 * secret shown when a webhook is created manually). Without it, webhook
 * deliveries are rejected — an unauthenticated order feed would let anyone
 * write revenue into the books.
 *
 * Note this is per-deployment, not per-organization: it verifies webhooks from
 * one Shopify app. Deliveries signed with any other app's secret are rejected
 * rather than mis-attributed, so this is a single-app limitation, not a hole —
 * but a genuinely multi-tenant deployment would need a secret per store.
 */
export const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";

/**
 * Public origin of this deployment, used to register Shopify webhook callbacks.
 * Vercel provides VERCEL_PROJECT_PRODUCTION_URL on production deployments.
 */
export const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "");

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
