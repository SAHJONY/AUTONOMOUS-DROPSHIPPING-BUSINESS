/**
 * Storage abstraction.
 *
 * Uses Upstash Redis (REST) when the standard env vars are present, and
 * otherwise falls back to a process-global in-memory store so the app still
 * builds, deploys, and demos with zero configuration. Add Upstash creds for
 * durable 24/7 persistence.
 */
import { Redis } from "@upstash/redis";

type Json = unknown;

interface KVDriver {
  get<T = Json>(key: string): Promise<T | null>;
  set(key: string, value: Json): Promise<void>;
  del(key: string): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  setIfAbsent(key: string, value: Json, seconds: number): Promise<boolean>;
  append(key: string, value: Json): Promise<void>;
  range<T = Json>(key: string, start: number, stop: number): Promise<T[]>;
}

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";

export const STORAGE_MODE: "upstash" | "memory" =
  UPSTASH_URL && UPSTASH_TOKEN ? "upstash" : "memory";

/* ---------- In-memory driver (survives within a warm lambda) ---------- */

type MemGlobal = {
  __commerceKV?: Map<string, string>;
  __commerceSets?: Map<string, Set<string>>;
  __commerceExpiry?: Map<string, number>;
  __commerceLists?: Map<string, string[]>;
};
const g = globalThis as unknown as MemGlobal;
g.__commerceKV ??= new Map();
g.__commerceSets ??= new Map();
g.__commerceExpiry ??= new Map();
g.__commerceLists ??= new Map();

function purgeExpired(key: string): void {
  const expiresAt = g.__commerceExpiry!.get(key);
  if (expiresAt !== undefined && expiresAt <= Date.now()) {
    g.__commerceKV!.delete(key);
    g.__commerceSets!.delete(key);
    g.__commerceExpiry!.delete(key);
    g.__commerceLists!.delete(key);
  }
}

const memoryDriver: KVDriver = {
  async get<T>(key: string): Promise<T | null> {
    purgeExpired(key);
    const raw = g.__commerceKV!.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  },
  async set(key: string, value: Json): Promise<void> {
    purgeExpired(key);
    g.__commerceKV!.set(key, JSON.stringify(value));
  },
  async del(key: string): Promise<void> {
    g.__commerceKV!.delete(key);
    g.__commerceSets!.delete(key);
    g.__commerceExpiry!.delete(key);
    g.__commerceLists!.delete(key);
  },
  async sadd(key: string, member: string): Promise<void> {
    purgeExpired(key);
    const set = g.__commerceSets!.get(key) ?? new Set<string>();
    set.add(member);
    g.__commerceSets!.set(key, set);
  },
  async smembers(key: string): Promise<string[]> {
    purgeExpired(key);
    return [...(g.__commerceSets!.get(key) ?? [])];
  },
  async incr(key: string): Promise<number> {
    purgeExpired(key);
    const raw = g.__commerceKV!.get(key);
    const current = raw === undefined ? 0 : Number(JSON.parse(raw));
    const next = Number.isFinite(current) ? current + 1 : 1;
    g.__commerceKV!.set(key, JSON.stringify(next));
    return next;
  },
  async expire(key: string, seconds: number): Promise<void> {
    g.__commerceExpiry!.set(key, Date.now() + Math.max(1, seconds) * 1000);
  },
  async setIfAbsent(key: string, value: Json, seconds: number): Promise<boolean> {
    purgeExpired(key);
    if (g.__commerceKV!.has(key)) return false;
    g.__commerceKV!.set(key, JSON.stringify(value));
    g.__commerceExpiry!.set(key, Date.now() + Math.max(1, seconds) * 1000);
    return true;
  },
  async append(key: string, value: Json): Promise<void> {
    purgeExpired(key);
    const list = g.__commerceLists!.get(key) ?? [];
    list.push(JSON.stringify(value));
    g.__commerceLists!.set(key, list);
  },
  async range<T>(key: string, start: number, stop: number): Promise<T[]> {
    purgeExpired(key);
    const list = g.__commerceLists!.get(key) ?? [];
    const normalizedStop = stop < 0 ? list.length + stop : stop;
    return list.slice(start, normalizedStop + 1).map((value) => JSON.parse(value) as T);
  },
};

/* ---------- Upstash driver ---------- */

let redis: Redis | null = null;
function client(): Redis {
  redis ??= new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
  return redis;
}

const upstashDriver: KVDriver = {
  async get<T>(key: string): Promise<T | null> {
    const v = await client().get<T>(key);
    return v ?? null;
  },
  async set(key: string, value: Json): Promise<void> {
    await client().set(key, value as never);
  },
  async del(key: string): Promise<void> {
    await client().del(key);
  },
  async sadd(key: string, member: string): Promise<void> {
    await client().sadd(key, member);
  },
  async smembers(key: string): Promise<string[]> {
    return (await client().smembers(key)) as string[];
  },
  async incr(key: string): Promise<number> {
    return await client().incr(key);
  },
  async expire(key: string, seconds: number): Promise<void> {
    await client().expire(key, Math.max(1, seconds));
  },
  async setIfAbsent(key: string, value: Json, seconds: number): Promise<boolean> {
    const result = await client().set(key, value as never, {
      nx: true,
      ex: Math.max(1, seconds),
    });
    return result === "OK";
  },
  async append(key: string, value: Json): Promise<void> {
    await client().rpush(key, value as never);
  },
  async range<T>(key: string, start: number, stop: number): Promise<T[]> {
    return (await client().lrange<T>(key, start, stop)) as T[];
  },
};

const driver: KVDriver = STORAGE_MODE === "upstash" ? upstashDriver : memoryDriver;

export const kv = driver;

/* ---------- List helpers (arrays stored as a single JSON value) ---------- */

export async function listGet<T>(key: string): Promise<T[]> {
  return (await kv.get<T[]>(key)) ?? [];
}

export async function listPush<T>(key: string, item: T, cap = 500): Promise<void> {
  const arr = await listGet<T>(key);
  arr.unshift(item);
  await kv.set(key, arr.slice(0, cap));
}

export async function listReplace<T>(key: string, items: T[]): Promise<void> {
  await kv.set(key, items);
}
