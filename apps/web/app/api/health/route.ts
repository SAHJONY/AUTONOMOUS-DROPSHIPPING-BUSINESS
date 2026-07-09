import { json } from "@/lib/api";
import { STORAGE_MODE } from "@/lib/kv";
import { BRAIN_MODEL, ANTHROPIC_API_KEY } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    status: "ok",
    app: "Claude Commerce OS",
    brain_model: BRAIN_MODEL,
    brain_live: !!ANTHROPIC_API_KEY,
    storage_mode: STORAGE_MODE,
  });
}
