import { json } from "@/lib/api";
import {
  ANTHROPIC_API_KEY,
  AUTONOMY_ENABLED,
  COMMERCE_RELEASE_ENABLED,
  CRON_SECRET,
  ENGINE_NAME,
  PRODUCT_NAME,
} from "@/lib/config";
import { STORAGE_MODE } from "@/lib/kv";
import { SHIFTS, shiftFor } from "@/lib/autonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);

  // The fleet only actually works when all three are true: the engine has a
  // key, the cron is authorized, and the release gate is open.
  const live = !!ANTHROPIC_API_KEY && !!CRON_SECRET && AUTONOMY_ENABLED;

  return json({
    status: "ok",
    app: PRODUCT_NAME,
    engine: ENGINE_NAME,
    engine_online: !!ANTHROPIC_API_KEY,
    // Durable storage keeps the fleet's work between ticks; "memory" resets on
    // cold starts, so 24/7 operation wants Upstash configured.
    storage: STORAGE_MODE,
    durable: STORAGE_MODE === "upstash",
    autonomy: {
      live,
      mode: "24/7 shift rotation",
      roster: SHIFTS.map((s) => s.agent),
      on_duty: shiftFor(now).agent,
      next_shift_at: next.toISOString(),
      cron_secured: !!CRON_SECRET,
      release_gate: AUTONOMY_ENABLED,
      publishing_gate: COMMERCE_RELEASE_ENABLED,
    },
  });
}
