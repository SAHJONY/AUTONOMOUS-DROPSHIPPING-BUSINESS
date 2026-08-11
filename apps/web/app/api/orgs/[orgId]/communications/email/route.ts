import { error, json, requireOrgRole } from "@/lib/api";
import { getBotanicaEmailStatus, listBotanicaEmails, sendBotanicaEmail } from "@/lib/botanica-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;
  return json({ ...getBotanicaEmailStatus(), messages: await listBotanicaEmails(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.confirmation !== "SEND EMAIL") return error("Type SEND EMAIL to confirm delivery.", 409);
  const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return error("A valid recipient email is required.", 400);
  if (!subject || !text) return error("Subject and message are required.", 400);
  try { return json({ ok:true, message:await sendBotanicaEmail({ orgId, to, subject, text }) }); }
  catch (cause) { return error(cause instanceof Error ? cause.message : "Email delivery failed.", 502); }
}
