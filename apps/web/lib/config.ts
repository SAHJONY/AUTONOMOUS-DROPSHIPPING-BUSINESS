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
export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
