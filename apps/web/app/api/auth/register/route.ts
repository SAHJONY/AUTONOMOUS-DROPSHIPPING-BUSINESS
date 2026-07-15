import { error, json } from "@/lib/api";
import { createToken, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createOrg, createUser, getUserByEmail } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limit = await rateLimit(req, {
    keyPrefix: "auth:register",
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) {
    const response = error("Too many registration attempts. Try again later.", 429);
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    response.headers.set("X-RateLimit-Limit", String(limit.limit));
    response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
    return response;
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !email.includes("@")) return error("A valid email is required.", 422);
  if (password.length < 8) return error("Password must be at least 8 characters.", 422);

  if (await getUserByEmail(email)) return error("Email already registered", 409);

  const user = await createUser({
    email,
    hashed_password: await hashPassword(password),
    full_name: String(body.full_name ?? ""),
  });
  await createOrg(String(body.organization_name ?? "My Business"), user.id, "owner");

  const response = json(
    { access_token: await createToken(user.id), token_type: "bearer" },
    201,
  );
  response.headers.set("X-RateLimit-Limit", String(limit.limit));
  response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
  return response;
}
