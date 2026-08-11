import { Resend } from "resend";
import { kv, listGet, listPush, listReplace } from "./kv";
import { newId, nowISO } from "./store";
import { notifyOwnerTelegram } from "./telegram";

export type BotanicaEmailMessage = {
  id: string;
  org_id: string;
  direction: "outbound" | "inbound";
  from: string;
  to: string[];
  subject: string;
  text: string;
  provider_id: string;
  status: "sent" | "received";
  created_at: string;
};

const apiKey = process.env.RESEND_API_KEY ?? "";
export const BOTANICA_EMAIL_FROM = process.env.BOTANICA_EMAIL_FROM ?? "BOTANICA OCHOSI <suppliers@botanicaochosi.com>";
export const BOTANICA_EMAIL_REPLY_TO = process.env.BOTANICA_EMAIL_REPLY_TO ?? "suppliers@botanicaochosi.com";
export const BOTANICA_EMAIL_ORG_ID = process.env.BOTANICA_EMAIL_ORG_ID ?? "";
export const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";
// The placeholder keeps build/test imports side-effect free; every network path
// rejects before use when the real server-only key is absent.
export const resend = new Resend(apiKey || "re_not_configured");

const key = (orgId: string) => `botanica_email:${orgId}`;

export function getBotanicaEmailStatus() {
  return {
    configured: Boolean(apiKey && BOTANICA_EMAIL_FROM && BOTANICA_EMAIL_REPLY_TO),
    receiving_configured: Boolean(apiKey && RESEND_WEBHOOK_SECRET && BOTANICA_EMAIL_ORG_ID),
    from: BOTANICA_EMAIL_FROM,
    reply_to: BOTANICA_EMAIL_REPLY_TO,
  };
}

export async function listBotanicaEmails(orgId: string): Promise<BotanicaEmailMessage[]> {
  return (await listGet<BotanicaEmailMessage>(key(orgId))).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Delete one message from the Owner OS history. Provider records remain untouched. */
export async function deleteBotanicaEmail(orgId: string, messageId: string): Promise<boolean> {
  const messages = await listGet<BotanicaEmailMessage>(key(orgId));
  const remaining = messages.filter((message) => message.id !== messageId);
  if (remaining.length === messages.length) return false;
  await listReplace(key(orgId), remaining);
  return true;
}

export async function sendBotanicaEmail(input: { orgId: string; to: string; subject: string; text: string }) {
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const idempotencyKey = `botanica-${input.orgId}-${await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${input.to}\n${input.subject}\n${input.text}`)).then((v) => Buffer.from(v).toString("hex").slice(0, 32))}`;
  const { data, error } = await resend.emails.send({
    from: BOTANICA_EMAIL_FROM,
    to: [input.to],
    replyTo: BOTANICA_EMAIL_REPLY_TO,
    subject: input.subject,
    text: input.text,
  }, { idempotencyKey });
  if (error || !data?.id) throw new Error(error?.message ?? "Email provider did not return a message id.");
  const message: BotanicaEmailMessage = { id:newId(), org_id:input.orgId, direction:"outbound", from:BOTANICA_EMAIL_FROM, to:[input.to], subject:input.subject, text:input.text, provider_id:data.id, status:"sent", created_at:nowISO() };
  await listPush(key(input.orgId), message, 1000);
  await notifyOwnerTelegram("EMAIL SENT", `${message.subject}\nTo: ${message.to.join(", ")}`);
  return message;
}

export async function storeInboundBotanicaEmail(emailId: string) {
  if (!BOTANICA_EMAIL_ORG_ID) throw new Error("BOTANICA_EMAIL_ORG_ID is not configured.");
  const duplicate = await kv.get<boolean>(`botanica_email:provider:${emailId}`);
  if (duplicate) return null;
  const { data, error } = await resend.emails.receiving.get(emailId);
  if (error || !data) throw new Error(error?.message ?? "Unable to retrieve inbound email.");
  const message: BotanicaEmailMessage = { id:newId(), org_id:BOTANICA_EMAIL_ORG_ID, direction:"inbound", from:data.from, to:data.to, subject:data.subject, text:data.text ?? "", provider_id:data.id, status:"received", created_at:data.created_at };
  await listPush(key(BOTANICA_EMAIL_ORG_ID), message, 1000);
  await kv.set(`botanica_email:provider:${emailId}`, true);
  await notifyOwnerTelegram("EMAIL RECEIVED", `${message.subject}\nFrom: ${message.from}`);
  return { message, headers:data.headers ?? {} };
}

export function shouldAutoRespondToInbound(input: { from:string; subject:string; headers?:Record<string,string> }) {
  const from=input.from.toLowerCase();
  const subject=input.subject.toLowerCase();
  const headers=Object.fromEntries(Object.entries(input.headers??{}).map(([key,value])=>[key.toLowerCase(),value.toLowerCase()]));
  if(from.includes("@botanicaochosi.com")||/mailer-daemon|postmaster|no-?reply|do-?not-?reply/.test(from))return false;
  if(/automatic reply|auto.?response|out of office|delivery status|undeliverable/.test(subject))return false;
  if(headers["auto-submitted"]&&headers["auto-submitted"]!=="no")return false;
  if(headers["precedence"]&&/bulk|junk|list/.test(headers["precedence"]))return false;
  return true;
}

export async function acknowledgeInboundEmail(message: BotanicaEmailMessage) {
  return sendBotanicaEmail({
    orgId:message.org_id,
    to:message.from.match(/<([^>]+)>/)?.[1]??message.from,
    subject:/^re:/i.test(message.subject)?message.subject:`Re: ${message.subject}`,
    text:"Thank you for contacting BOTANICA OCHOSI. We received your message and our supplier operations team is reviewing it. We will respond with the appropriate next step using verified catalog, pricing, fulfillment, and authorization information.\n\nThis acknowledgment does not authorize a purchase, contract, payment, resale commitment, or disclosure of credentials.\n\nBOTANICA OCHOSI\nhttps://www.botanicaochosi.com",
  });
}
