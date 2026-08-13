/**
 * Go-live preflight.
 *
 * A deployment can be green in CI, build clean, and still be one cold start away
 * from losing every order it ever recorded. This module answers the question a
 * deploy pipeline cannot: *is this environment actually fit to run a business?*
 *
 * `assessReadiness` is pure so the rules are directly testable — the route
 * gathers the facts, this decides what they mean.
 */

export type CheckLevel = "blocker" | "warning" | "ok";

export interface ReadinessCheck {
  id: string;
  label: string;
  level: CheckLevel;
  detail: string;
  /** What to actually do about it. Omitted when nothing needs doing. */
  fix?: string;
}

export interface Readiness {
  /** True when nothing is a blocker. Warnings are survivable; blockers are not. */
  ready: boolean;
  blockers: number;
  warnings: number;
  checks: ReadinessCheck[];
}

export interface ReadinessFacts {
  storageMode: "upstash" | "memory";
  jwtSecretIsDefault: boolean;
  ownerPasswordSet: boolean;
  cronSecretSet: boolean;
  engineKeySet: boolean;
  webhookSecretSet: boolean;
  publicBaseUrlSet: boolean;
  shopifyConnected: boolean;
  cjConnected: boolean;
  autonomyEnabled: boolean;
  commerceReleaseEnabled: boolean;
  autoFulfillEnabled: boolean;
}

/**
 * The subset of readiness that decides whether *unattended* work may touch
 * money or customers.
 *
 * Autonomy multiplies whatever the deployment already is. On the in-memory
 * fallback that means buying goods against books that will silently reset, and
 * on the default signing key it means doing so on a deployment anyone can log
 * into as the owner. A human pressing the button can see the warning on the
 * deck; a cron at 3am cannot. So the loop checks this itself and skips the
 * money-moving steps rather than trusting the operator to have read the
 * checklist first.
 *
 * Without OWNER_PASSWORD nobody can sign in as the owner at all, so an
 * unattended loop would spend with no one able to reach the controls and stop
 * it. That is the case the gate exists for, not an exception to it.
 *
 * Read-only and advisory work is unaffected — it costs nothing and is not
 * destructive.
 */
export function assessAutonomySafety(f: Pick<ReadinessFacts, "storageMode" | "jwtSecretIsDefault" | "ownerPasswordSet">) {
  const blockers: string[] = [];
  if (f.storageMode !== "upstash") blockers.push("Almacenamiento en memoria: los pedidos y el libro contable se pierden en el próximo arranque en frío.");
  if (f.jwtSecretIsDefault) blockers.push("JWT_SECRET sigue siendo el valor por defecto, que es público en el código fuente.");
  if (!f.ownerPasswordSet) blockers.push("OWNER_PASSWORD no está definido: nadie puede iniciar sesión como propietario para supervisar ni detener el ciclo.");
  return { safe: blockers.length === 0, blockers };
}

export function assessReadiness(f: ReadinessFacts): Readiness {
  const checks: ReadinessCheck[] = [];

  // --- Blockers: things that make the deployment unfit to hold a business ----

  checks.push(
    f.storageMode === "upstash"
      ? {
          id: "storage",
          label: "Durable storage",
          level: "ok",
          detail: "Upstash Redis is connected. Orders and the ledger survive restarts.",
        }
      : {
          id: "storage",
          label: "Durable storage",
          level: "blocker",
          detail:
            "Running on the in-memory fallback. Every order, ledger entry, product and " +
            "account is lost on the next cold start — and serverless functions cold-start " +
            "constantly. The books would silently reset.",
          fix: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN before taking orders.",
        },
  );

  checks.push(
    f.jwtSecretIsDefault
      ? {
          id: "jwt",
          label: "Session signing key",
          level: "blocker",
          detail:
            "JWT_SECRET is still the built-in default, which is public in the source. " +
            "Anyone could mint a valid token for any account, including the owner.",
          fix: "Set JWT_SECRET to a long random value.",
        }
      : {
          id: "jwt",
          label: "Session signing key",
          level: "ok",
          detail: "A custom JWT_SECRET is configured.",
        },
  );

  checks.push(
    f.ownerPasswordSet
      ? {
          id: "owner",
          label: "Owner sign-in",
          level: "ok",
          detail: "OWNER_PASSWORD is set, so the owner account exists and can sign in.",
        }
      : {
          id: "owner",
          label: "Owner sign-in",
          level: "blocker",
          detail:
            "OWNER_PASSWORD is not set, so the owner account is never created. The owner cannot " +
            "sign in, which means no approvals, no store connection, and no way to run the " +
            "business — registration deliberately refuses the owner email, so there is no way in.",
          fix: "Set OWNER_PASSWORD to a long random value, then sign in at /owner/login.",
        },
  );

  // --- Warnings: degraded but safe -----------------------------------------

  checks.push(
    f.cronSecretSet
      ? {
          id: "cron",
          label: "Scheduled operations",
          level: "ok",
          detail: "CRON_SECRET is set, so the daily and fulfillment crons can run.",
        }
      : {
          id: "cron",
          label: "Scheduled operations",
          level: "warning",
          detail:
            "CRON_SECRET is not set. Both crons fail closed with 503, so nothing runs on a " +
            "schedule — orders will only move when you press Fulfill now.",
          fix: "Set CRON_SECRET to a long random value.",
        },
  );

  checks.push(
    f.shopifyConnected
      ? {
          id: "shopify",
          label: "Storefront",
          level: "ok",
          detail: "A Shopify store is connected, so products can be listed and orders collected.",
        }
      : {
          id: "shopify",
          label: "Storefront",
          level: "warning",
          detail: "No Shopify store is connected. Nothing can be sold or fulfilled.",
          fix: "Connect a store from the dashboard with read_orders and write_fulfillments scopes.",
        },
  );

  checks.push(
    f.cjConnected
      ? {
          id: "supplier",
          label: "Supplier",
          level: "ok",
          detail: "CJ Dropshipping is connected, so orders can actually be sourced and shipped.",
        }
      : {
          id: "supplier",
          label: "Supplier",
          level: "warning",
          detail:
            "No supplier is connected. Orders can be taken but not filled — every paid order " +
            "would land on hold with a customer waiting.",
          fix: "Connect CJ Dropshipping from the dashboard.",
        },
  );

  const realtime = f.webhookSecretSet && f.publicBaseUrlSet;
  checks.push(
    realtime
      ? {
          id: "webhooks",
          label: "Order feed",
          level: "ok",
          detail: "Shopify webhooks are configured, so orders arrive in real time and are verified.",
        }
      : {
          id: "webhooks",
          label: "Order feed",
          level: "warning",
          detail:
            `Real-time orders are off (${!f.webhookSecretSet ? "SHOPIFY_WEBHOOK_SECRET missing" : "PUBLIC_BASE_URL missing"}). ` +
            "Orders are still collected by the polling sync, but only when a cron runs.",
          fix: "Set SHOPIFY_WEBHOOK_SECRET and PUBLIC_BASE_URL, then reconnect the store.",
        },
  );

  checks.push(
    f.engineKeySet
      ? {
          id: "engine",
          label: "Autonomous engine",
          level: "ok",
          detail: "The engine key is set — agents reason live rather than in standby mode.",
        }
      : {
          id: "engine",
          label: "Autonomous engine",
          level: "warning",
          detail:
            "No engine key, so agents run in deterministic standby mode. The order and " +
            "fulfillment loops are unaffected — they do not use the model.",
          fix: "Set OPENAI_API_KEY to activate the Codex-powered agents.",
        },
  );

  // --- Posture: not problems, but the operator must know which way these sit --

  checks.push({
    id: "gates",
    label: "Release gates",
    level: "ok",
    detail: f.autonomyEnabled
      ? "ENABLE_AUTONOMY is ON. The business may auto-approve actions within their caps."
      : "ENABLE_AUTONOMY is OFF. Nothing is auto-approved and no autonomous spending happens.",
  });

  checks.push({
    id: "publishing",
    label: "Publishing lock",
    level: "ok",
    detail: f.commerceReleaseEnabled
      ? "COMMERCE_RELEASE_ENABLED is ON. Products can be published to the storefront."
      : "COMMERCE_RELEASE_ENABLED is OFF. Publishing is locked and returns 423.",
  });

  checks.push({
    id: "fulfillment",
    label: "Autonomous fulfillment",
    level: "ok",
    detail: f.autoFulfillEnabled
      ? "Paid orders are bought from the supplier automatically, within the cost cap."
      : "Auto-fulfillment is off. Supplier orders are placed only when you press the button.",
  });

  const blockers = checks.filter((c) => c.level === "blocker").length;
  const warnings = checks.filter((c) => c.level === "warning").length;
  return { ready: blockers === 0, blockers, warnings, checks };
}
