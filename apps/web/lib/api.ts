/** Shared helpers for Next.js route handlers: auth extraction and responses. */
import { NextResponse } from "next/server";
import { verifyToken } from "./auth";
import { getUser, userCanAccessOrg } from "./store";
import type { User } from "./types";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
export function error(detail: string, status = 400): NextResponse {
  return NextResponse.json({ detail }, { status });
}

export async function currentUser(req: Request): Promise<User | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const userId = await verifyToken(token);
  if (!userId) return null;
  const user = await getUser(userId);
  return user && user.is_active ? user : null;
}

/** Require an authenticated user or return a 401 response. */
export async function requireUser(
  req: Request,
): Promise<{ user: User } | { response: NextResponse }> {
  const user = await currentUser(req);
  if (!user) return { response: error("Not authenticated", 401) };
  return { user };
}

/** Require auth AND access to the given org (owner has universal access). */
export async function requireOrg(
  req: Request,
  orgId: string,
): Promise<{ user: User } | { response: NextResponse }> {
  const auth = await requireUser(req);
  if ("response" in auth) return auth;
  if (!(await userCanAccessOrg(auth.user, orgId))) {
    return { response: error("Organization not found", 404) };
  }
  return { user: auth.user };
}
