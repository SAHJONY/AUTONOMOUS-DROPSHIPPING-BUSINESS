/**
 * Central configuration for BOTANICA OCHOSI (Vercel-native).
 *
 * The app runs entirely on Vercel: Next.js route handlers are the backend,
 * Upstash Redis (with an in-memory fallback) is the datastore, and the OCHOSI Intelligence Engine
 * is the brain behind every autonomous decision.
 */

/** Brand identity. The engine internals are never exposed to end users. */
export const BRAND = "BOTANICA OCHOSI";
export const BRAND_DOMAIN = process.env.BRAND_DOMAIN ?? "www.botanicaochosi.com";
export const PRODUCT_NAME = "BOTANICA OCHOSI Commerce OS";
export const ENGINE_NAME = "OCHOSI Intelligence Engine";

/** The unrestricted super-admin / owner of this deployment. */
export const OWNER_EMAIL = "sahjonycapitalllc@outlook.com";

/** Model that powers the autonomous engine (internal — never surfaced to users). */
export const BRAIN_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6";

/** Product opportunity launch threshold (0-100). Only 85+ ships. */
export const LAUNCH_SCORE_THRESHOLD = Number(process.env.LAUNCH_SCORE_THRESHOLD ?? 85);

/** JWT signing secret. MUST be set in production. */
export const JWT_SECRET = process.env.JWT_SECRET ?? process.env.SECRET_KEY ?? "change-me-in-production-commerce-os";

/** Token lifetime, in seconds (default 7 days). */
export const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7);

/** Secret that authorizes the 24/7 autonomous cron endpoint. */
export const CRON_SECRET = process.env.CRON_SECRET ?? "";

/** OpenAI Responses API key for the Codex-powered production brain. */
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

/** Owner bootstrap password, set in Vercel env. */
export const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? "";

export const AGENT_MAX_ITERATIONS = Number(process.env.AGENT_MAX_ITERATIONS ?? 12);
export const AGENT_MAX_TOKENS = Number(process.env.AGENT_MAX_TOKENS ?? 16000);

export const AUTOPILOT_DEFAULT = (process.env.AUTOPILOT ?? "false") === "true";
export const AUTONOMY_ENABLED = process.env.ENABLE_AUTONOMY === "true";
export const COMMERCE_RELEASE_ENABLED = process.env.COMMERCE_RELEASE_ENABLED === "true";
export const AUTOPILOT_MAX_AD_BUDGET = Number(process.env.AUTOPILOT_MAX_AD_BUDGET ?? 50);
export const AUTOPILOT_MAX_REFUND = Number(process.env.AUTOPILOT_MAX_REFUND ?? 50);
/** Hard ceiling for unattended supplier purchases during the lean launch. */
export const AUTOPILOT_MAX_ORDER_COST = Math.min(
  100,
  Math.max(0, Number(process.env.AUTOPILOT_MAX_ORDER_COST ?? 100) || 0),
);
export const AUTO_FULFILL_DEFAULT = process.env.AUTO_FULFILL === "true";
export const HOLD_RISKY_ORDERS = (process.env.HOLD_RISKY_ORDERS ?? "true") !== "false";
export const PAYMENT_FEE_RATE = Number(process.env.PAYMENT_FEE_RATE ?? 0.029);
export const PAYMENT_FEE_FIXED = Number(process.env.PAYMENT_FEE_FIXED ?? 0.3);
export const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";

/** Canonical production origin used for Shopify callbacks and absolute links. */
export const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.botanicaochosi.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
