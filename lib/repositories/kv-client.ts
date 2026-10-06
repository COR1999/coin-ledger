/**
 * Real Redis-backed KvClient, constructed from env vars. Split from
 * kv-snapshot.ts (which has no "server-only" and no @upstash/redis import)
 * for the same reason lib/env.ts is split from lib/env.schema.ts: this file
 * constructs a real SDK client, which isn't worth exercising in unit tests —
 * the read-modify-write logic that actually matters is already covered
 * against a fake KvClient in kv-snapshot.test.ts.
 */
import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";
import type { KvClient } from "./kv-snapshot";

let cached: KvClient | null | undefined;

/**
 * Returns a Redis-backed client, or `null` if UPSTASH_REDIS_REST_URL/TOKEN
 * aren't configured. Callers (workspace-store.ts, waitlist.ts) fall back to
 * the existing in-memory globalThis store when this is null — nothing
 * changes for local dev or any deployment that hasn't provisioned Redis.
 */
export function getKvClientIfConfigured(): KvClient | null {
  if (cached !== undefined) return cached;

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    cached = null;
    return cached;
  }

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  cached = {
    get: (key) => redis.get(key),
    set: (key, value) => redis.set(key, value),
  };
  return cached;
}
