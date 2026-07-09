import { json, requireUser } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const { id, email, full_name, is_active, is_owner } = auth.user;
  return json({ id, email, full_name, is_active, is_owner });
}
