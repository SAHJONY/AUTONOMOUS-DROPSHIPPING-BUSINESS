import { after } from "next/server";
import { acknowledgeInboundEmail, resend, RESEND_WEBHOOK_SECRET, shouldAutoRespondToInbound, storeInboundBotanicaEmail } from "@/lib/botanica-email";
import { error, json } from "@/lib/api";
import { runAgent } from "@/lib/brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!RESEND_WEBHOOK_SECRET) return error("Email receiving is not configured.", 503);
  const payload = await req.text();
  let event;
  try {
    event = resend.webhooks.verify({ payload, webhookSecret:RESEND_WEBHOOK_SECRET, headers:{ id:req.headers.get("svix-id") ?? "", timestamp:req.headers.get("svix-timestamp") ?? "", signature:req.headers.get("svix-signature") ?? "" } });
  } catch { return error("Invalid webhook signature.", 401); }
  if (event.type === "email.received") {
    const inbound=await storeInboundBotanicaEmail(event.data.email_id);
    if(inbound&&process.env.AUTONOMOUS_EMAIL_RESPONSES==="true"&&shouldAutoRespondToInbound({from:inbound.message.from,subject:inbound.message.subject,headers:inbound.headers})){
      await acknowledgeInboundEmail(inbound.message);
      after(async()=>{
        await runAgent({orgId:inbound.message.org_id,agentName:"supplier",task:`Review this newly received supplier email after the automatic acknowledgment. Use list_supplier_email for context. Send a concise substantive reply only when the message contains a clear routine request or supplies actionable business terms. Do not repeat the acknowledgment. Never authorize purchases, contracts, payments, exclusivity, legal terms, or share credentials. If those are requested, record the issue in memory and do not send.\n\nFROM: ${inbound.message.from}\nSUBJECT: ${inbound.message.subject}\nBODY:\n${inbound.message.text.slice(0,12000)}`});
      });
    }
  }
  return json({ ok:true });
}
