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
};
const g = globalThis as unknown as MemGlobal;
g.__commerceKV ??= new Map();
g.__commerceSets ??= new Map();

const memoryDriver: KVDriver = {
  async get<T>(key: string): Promise<T | null> {
    const raw = g.__commerceKV!.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  },
  async set(key: string, value: Json): Promise<void> {
    g.__commerceKV!.set(key, JSON.stringify(value));
  },
  async del(key: string): Promise<void> {
    g.__commerceKV!.delete(key);
  },
  async sadd(key: string, member: string): Promise<void> {
    const set = g.__commerceSets!.get(key) ?? new Set<string>();
    set.add(member);
    g.__commerceSets!.set(key, set);
  },
  async smembers(key: string): Promise<string[]> {
    return [...(g.__commerceSets!.get(key) ?? [])];
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
