import { error, json, requireOrgRole } from "@/lib/api";
import { getTelegramStatus, sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  return json(getTelegramStatus());
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({})) as { message?: unknown; confirmation?: unknown };
  if (body.confirmation !== "POST TO TELEGRAM") {
    return error("Type POST TO TELEGRAM to confirm this channel post.", 409);
  }
  if (typeof body.message !== "string" || !body.message.trim()) {
    return error("A Telegram message is required.", 400);
  }

  const result = await sendTelegramMessage(body.message);
  if (!result.ok) return error(result.detail ?? "Telegram publish failed.", 502);
  return json({ ok: true, channel: result.channel, message_id: result.message_id ?? null });
}
