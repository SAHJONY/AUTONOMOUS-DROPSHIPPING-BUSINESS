import { error, json } from "@/lib/api";
import { createToken, verifyPassword } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { ensureOwnerFromEnv, getUserByEmail } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limit = await rateLimit(req, {
    keyPrefix: "auth:login",
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (!limit.allowed) {
    const response = error("Too many login attempts. Try again later.", 429);
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    response.headers.set("X-RateLimit-Limit", String(limit.limit));
    response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
    return response;
  }

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

  const response = json({ access_token: await createToken(user.id), token_type: "bearer" });
  response.headers.set("X-RateLimit-Limit", String(limit.limit));
  response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
  return response;
}
