/**
 * Central configuration for Claude Commerce OS (Vercel-native edition).
 *
 * The app runs entirely on Vercel: Next.js route handlers are the backend,
 * Upstash Redis (with an in-memory fallback) is the datastore, and Claude
 * Fable 5 is the brain and engine behind every autonomous decision.
 */

/** The unrestricted super-admin / owner of this deployment. */
export const OWNER_EMAIL = "sahjonycapitalllc@outlook.com";

/** Model that powers the autonomous brain. Fable 5 by default. */
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

/** Anthropic key — when absent the brain runs in deterministic simulation mode. */
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

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
