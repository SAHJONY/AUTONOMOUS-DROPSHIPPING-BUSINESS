import { kv } from "./kv";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Fixed-window limiter backed by the shared KV abstraction.
 * Upstash uses atomic INCR; local/demo mode uses the process-global memory store.
 */
export async function rateLimit(
  req: Request,
  options: { keyPrefix: string; limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const window = Math.floor(nowSeconds / options.windowSeconds);
  const key = `ratelimit:${options.keyPrefix}:${clientIp(req)}:${window}`;
  const count = await kv.incr(key);

  if (count === 1) {
    await kv.expire(key, options.windowSeconds + 5);
  }

  const windowEndsAt = (window + 1) * options.windowSeconds;
  return {
    allowed: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSeconds: Math.max(1, windowEndsAt - nowSeconds),
  };
}
