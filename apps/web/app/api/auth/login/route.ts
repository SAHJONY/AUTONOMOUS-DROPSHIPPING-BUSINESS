import { error, json } from "@/lib/api";
import { createToken, verifyPassword } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/config";
import { ensureOwnerFromEnv, getUserByEmail } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  // Owner account is bootstrapped/kept in sync from the OWNER_PASSWORD env var.
  if (isOwnerEmail(email)) await ensureOwnerFromEnv();

  const user = await getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.hashed_password))) {
    return error("Invalid email or password", 401);
  }
  if (!user.is_active) return error("Account disabled", 403);

  return json({ access_token: await createToken(user.id), token_type: "bearer" });
}
