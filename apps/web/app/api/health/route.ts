import { json } from "@/lib/api";
import { ENGINE_NAME, PRODUCT_NAME, ANTHROPIC_API_KEY } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    status: "ok",
    app: PRODUCT_NAME,
    engine: ENGINE_NAME,
    engine_online: !!ANTHROPIC_API_KEY,
  });
}
