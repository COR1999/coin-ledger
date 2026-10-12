/**
 * Cross-process mutual exclusion on top of a shared key-value store (Redis).
 *
 * lib/concurrency.ts's `runExclusive` only serializes callers inside one
 * Node process. On Vercel, two requests for the same workspace can land on
 * two serverless instances, so anything that read-modify-writes shared state
 * (a workspace snapshot, the waitlist) or moves money (payment execution)
 * also needs a lock every instance can see.
 *
 * Classic single-instance Redis lock: `SET key token NX PX ttl` to acquire,
 * delete-if-token-matches to release. The TTL bounds how long a crashed
 * holder can block others. The token stops a holder whose lock already
 * expired from deleting someone else's.
 *
 * Pure and framework-free: the store is injected, so the logic is unit
 * tested against an in-memory fake with no network.
 */
import { describeError } from "@/lib/log-error";

export interface LockStore {
  /** Atomically set `key` to `token` with a TTL, only if `key` is absent.
   * Resolves true if this call acquired the lock. */
  tryAcquireLock(key: string, token: string, ttlMs: number): Promise<boolean>;
  /** Delete `key` only if it still holds `token`. */
  releaseLock(key: string, token: string): Promise<void>;
}

export interface LockOptions {
  /** Auto-expiry if the holder dies. Must exceed the guarded work's runtime. */
  ttlMs: number;
  /** How long to keep retrying before giving up. 0 = try once (fail fast). */
  waitMs: number;
  /** Delay between attempts while waiting. */
  retryDelayMs: number;
}

export class LockUnavailableError extends Error {
  constructor(public readonly key: string) {
    super(`Lock "${key}" is held by another process`);
    this.name = "LockUnavailableError";
  }
}

/**
 * Runs `fn` while holding `key` across every process sharing `store`.
 * With no store configured (local dev, in-memory storage) there is nothing
 * shared to protect, so `fn` just runs.
 */
export async function withDistributedLock<T>(
  store: LockStore | null,
  key: string,
  options: LockOptions,
  fn: () => Promise<T>,
): Promise<T> {
  if (!store) return fn();

  const token = crypto.randomUUID();
  const deadline = Date.now() + options.waitMs;
  while (!(await store.tryAcquireLock(key, token, options.ttlMs))) {
    if (Date.now() + options.retryDelayMs >= deadline) {
      throw new LockUnavailableError(key);
    }
    await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs));
  }

  try {
    return await fn();
  } finally {
    try {
      await store.releaseLock(key, token);
    } catch (error) {
      // The guarded work already finished; failing it now would misreport
      // its outcome. The TTL frees the lock regardless.
      console.error(`Failed to release lock "${key}":`, describeError(error));
    }
  }
}

/** In-memory LockStore for tests: same semantics, including TTL expiry. */
export function createInMemoryLockStore(): LockStore {
  const held = new Map<string, { token: string; expiresAt: number }>();
  return {
    async tryAcquireLock(key, token, ttlMs) {
      const current = held.get(key);
      if (current && current.expiresAt > Date.now()) return false;
      held.set(key, { token, expiresAt: Date.now() + ttlMs });
      return true;
    },
    async releaseLock(key, token) {
      if (held.get(key)?.token === token) held.delete(key);
    },
  };
}
