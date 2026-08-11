type TelegramStatus = {
  configured: boolean;
  token_configured: boolean;
  channel_configured: boolean;
  channel: string | null;
  detail: string;
};

type TelegramSendResult = {
  ok: boolean;
  message_id?: number;
  channel?: string;
  detail?: string;
};

function cleanChannel(value: string | undefined): string | null {
  const channel = value?.trim();
  if (!channel) return null;
  return channel;
}

export function getTelegramStatus(): TelegramStatus {
  const tokenConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const channel = cleanChannel(process.env.TELEGRAM_CHANNEL_ID ?? process.env.TELEGRAM_CHANNEL_USERNAME);
  const channelConfigured = Boolean(channel);
  const configured = tokenConfigured && channelConfigured;

  return {
    configured,
    token_configured: tokenConfigured,
    channel_configured: channelConfigured,
    channel,
    detail: configured
      ? "Telegram bot and channel are configured for server-side publishing."
      : !tokenConfigured && !channelConfigured
        ? "TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID are not available in the runtime environment."
        : !tokenConfigured
          ? "TELEGRAM_BOT_TOKEN is not available in the runtime environment."
          : "TELEGRAM_CHANNEL_ID (or TELEGRAM_CHANNEL_USERNAME) is not configured.",
  };
}

export async function sendTelegramMessage(text: string, targetChatId?: string | number): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const channel = targetChatId === undefined
    ? cleanChannel(process.env.TELEGRAM_CHANNEL_ID ?? process.env.TELEGRAM_CHANNEL_USERNAME)
    : String(targetChatId);
  if (!token || !channel) return { ok: false, detail: getTelegramStatus().detail };

  const message = text.trim();
  if (!message) return { ok: false, detail: "Telegram message cannot be empty." };
  if (message.length > 4096) return { ok: false, detail: "Telegram message exceeds the 4096-character limit." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channel, text: message, disable_web_page_preview: false }),
      signal: controller.signal,
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({})) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };
    if (!response.ok || body.ok !== true) {
      return { ok: false, detail: body.description || `Telegram API request failed (${response.status}).` };
    }
    return { ok: true, message_id: body.result?.message_id, channel };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Telegram request failed." };
  } finally {
    clearTimeout(timeout);
  }
}

/** Best-effort owner alert. Notification failures never block commerce. */
export async function notifyOwnerTelegram(title: string, detail: string): Promise<void> {
  if(process.env.TELEGRAM_NOTIFICATIONS_ENABLED!=="true")return;
  const safeTitle=title.trim().slice(0,160);
  const safeDetail=detail.trim().slice(0,3600);
  try{await sendTelegramMessage(`BOTANICA OCHOSI · ${safeTitle}\n\n${safeDetail}\n\nOwner OS: https://www.botanicaochosi.com/owner`);}catch{/* non-fatal */}
}
