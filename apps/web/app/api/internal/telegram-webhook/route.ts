import { error, json } from "@/lib/api";
import { CRON_SECRET, PUBLIC_BASE_URL } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!CRON_SECRET || req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return error("Not authorized.", 401);
  }
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!token || !secret) return error("Telegram webhook configuration is incomplete.", 503);

  const webhookUrl = `${PUBLIC_BASE_URL.replace(/\/$/, "")}/api/webhooks/telegram`;
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ ok: false, webhook_url: webhookUrl, result }, 502);
  return json({ ok: true, webhook_url: webhookUrl, result });
}
