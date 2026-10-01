/**
 * In-memory fixed-window rate limiter. Deliberately simple for a demo
 * deployment: caps requests per key (e.g. client IP) per hour, protecting a
 * shared external quota (Gemini's free tier) from one visitor exhausting it.
 *
 * Known limitation: state is per-process. On a serverless platform (Vercel),
 * separate function instances don't share this Map, so a determined visitor
 * spread across cold starts/regions isn't fully blocked — this raises the
 * bar against casual spam, it isn't a hard guarantee. A shared store (e.g.
 * Upstash Redis) would close that gap if it proves necessary.
 */

interface WindowState {
  count: number;
  windowStartMs: number;
}

const windows = new Map<string, WindowState>();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window resets, only set when not allowed. */
  retryAfterSeconds?: number;
}

/**
 * Records one request for `key` and reports whether it's within `limit` per
 * `windowMs`. `now` is injectable for tests; defaults to the real clock.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || now - existing.windowStartMs >= windowMs) {
    windows.set(key, { count: 1, windowStartMs: now });
    return { allowed: true };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.ceil(
      (existing.windowStartMs + windowMs - now) / 1000,
    );
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true };
}

/** Test-only: clears all tracked windows so tests don't leak state. */
export function resetRateLimits(): void {
  windows.clear();
}
