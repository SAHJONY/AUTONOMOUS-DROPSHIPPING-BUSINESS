import { json } from "@/lib/api";
import {
  OPENAI_API_KEY,
  AUTONOMY_ENABLED,
  COMMERCE_RELEASE_ENABLED,
  CRON_SECRET,
  ENGINE_NAME,
  OWNER_PASSWORD,
  PRODUCT_NAME,
} from "@/lib/config";
import { STORAGE_MODE } from "@/lib/kv";
import { SHIFTS, autonomySafety, shiftFor } from "@/lib/autonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);

  // The fleet only actually works when all three are true: the engine has a
  // key, the cron is authorized, and the release gate is open.
  const live = !!OPENAI_API_KEY && !!CRON_SECRET && AUTONOMY_ENABLED;

  // Even with all three, the loop holds back money-moving work on a deployment
  // that would lose the books or that anyone could sign into as the owner.
  const safety = autonomySafety();

  return json({
    status: "ok",
    app: PRODUCT_NAME,
    engine: ENGINE_NAME,
    engine_online: !!OPENAI_API_KEY,
    // Durable storage keeps the fleet's work between ticks; "memory" resets on
    // cold starts, so 24/7 operation wants Upstash configured.
    storage: STORAGE_MODE,
    durable: STORAGE_MODE === "upstash",
    // Public on purpose: without this the owner cannot sign in at all, and the
    // readiness endpoint that would say so requires the sign-in you cannot do.
    owner_sign_in_ready: !!OWNER_PASSWORD,
    autonomy: {
      live,
      mode: "24/7 shift rotation",
      roster: SHIFTS.map((s) => s.agent),
      on_duty: shiftFor(now).agent,
      next_shift_at: next.toISOString(),
      cron_secured: !!CRON_SECRET,
      release_gate: AUTONOMY_ENABLED,
      publishing_gate: COMMERCE_RELEASE_ENABLED,
      money_moving_enabled: safety.safe,
      held_for_readiness: safety.blockers,
    },
  });
}
