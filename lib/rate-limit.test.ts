import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

describe("checkRateLimit", () => {
  afterEach(() => {
    resetRateLimits();
  });

  it("allows requests up to the limit within a window", () => {
    const key = "1.2.3.4";
    expect(checkRateLimit(key, 3, 60_000, 0).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000, 10).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000, 20).allowed).toBe(true);
  });

  it("blocks the request that exceeds the limit", () => {
    const key = "1.2.3.4";
    checkRateLimit(key, 2, 60_000, 0);
    checkRateLimit(key, 2, 60_000, 10);
    const result = checkRateLimit(key, 2, 60_000, 20);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the count once the window elapses", () => {
    const key = "1.2.3.4";
    checkRateLimit(key, 1, 60_000, 0);
    expect(checkRateLimit(key, 1, 60_000, 30_000).allowed).toBe(false);
    expect(checkRateLimit(key, 1, 60_000, 60_001).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    checkRateLimit("1.1.1.1", 1, 60_000, 0);
    expect(checkRateLimit("1.1.1.1", 1, 60_000, 0).allowed).toBe(false);
    expect(checkRateLimit("2.2.2.2", 1, 60_000, 0).allowed).toBe(true);
  });
});
