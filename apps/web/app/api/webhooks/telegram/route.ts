import { after } from "next/server";
import { error, json } from "@/lib/api";
import { decideApproval, runAgent } from "@/lib/brain";
import { kv } from "@/lib/kv";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type TelegramUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { id?: number; is_bot?: boolean };
  };
};

const AGENTS = new Set(["ceo", "product_hunter", "supplier", "store_builder", "marketing", "advertising", "finance", "support"]);

function help(): string {
  return [
    "BOTANICA OCHOSI · Codex command channel",
    "",
    "Send any request to the CEO agent, or use:",
    "/agent <name> <task>",
    "/approve <approval-id>",
    "/reject <approval-id> [reason]",
    "/help",
  ].join("\n");
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) return error("Telegram command channel is not configured.", 503);
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return error("Invalid Telegram webhook secret.", 401);
  }

  const update = await req.json().catch(() => null) as TelegramUpdate | null;
  const chatId = update?.message?.chat?.id;
  const senderId = update?.message?.from?.id;
  const text = update?.message?.text?.trim();
  if (!chatId || !senderId || !text || update?.message?.from?.is_bot) return json({ ok: true });

  const ownerChatId = process.env.TELEGRAM_OWNER_CHAT_ID?.trim();
  const ownerUserId = process.env.TELEGRAM_OWNER_USER_ID?.trim();
  if (!ownerChatId || String(chatId) !== ownerChatId || (ownerUserId && String(senderId) !== ownerUserId)) {
    return error("This Telegram account is not authorized.", 403);
  }

  if (update?.update_id !== undefined) {
    const fresh = await kv.setIfAbsent(`telegram:update:${update.update_id}`, true, 86_400);
    if (!fresh) return json({ ok: true, duplicate: true });
  }

  const orgId = process.env.BOTANICA_EMAIL_ORG_ID?.trim();
  if (!orgId) return error("Owner organization is not configured.", 503);

  if (text === "/start" || text === "/help") {
    await sendTelegramMessage(help(), chatId);
    return json({ ok: true });
  }

  const approval = text.match(/^\/(approve|reject)\s+([a-zA-Z0-9_-]+)(?:\s+([\s\S]+))?$/);
  if (approval) {
    const decision = approval[1] as "approve" | "reject";
    after(async () => {
      try {
        const result = await decideApproval(orgId, approval[2], decision, `telegram:${senderId}`, "owner", approval[3] ?? "");
        await sendTelegramMessage(`Approval ${result.id}: ${result.status}\n${result.result || "Decision recorded."}`, chatId);
      } catch (cause) {
        await sendTelegramMessage(`Approval failed: ${cause instanceof Error ? cause.message : "Unknown error"}`, chatId);
      }
    });
    return json({ ok: true, accepted: true });
  }

  let agentName = "ceo";
  let task = text;
  const agentCommand = text.match(/^\/agent\s+(\w+)\s+([\s\S]+)$/);
  if (agentCommand) {
    agentName = agentCommand[1].toLowerCase();
    task = agentCommand[2].trim();
    if (!AGENTS.has(agentName)) {
      await sendTelegramMessage(`Unknown agent '${agentName}'.\n\n${help()}`, chatId);
      return json({ ok: true });
    }
  }

  await sendTelegramMessage(`Codex received your request. Running ${agentName.replace(/_/g, " ")}…`, chatId);
  after(async () => {
    const run = await runAgent({ orgId, agentName, task, notify: false });
    const result = run.status === "failed" ? run.error : run.output;
    await sendTelegramMessage(`CODEX · ${agentName.toUpperCase()} · ${run.status}\n\n${result.slice(0, 3800)}`, chatId);
  });
  return json({ ok: true, accepted: true });
}
