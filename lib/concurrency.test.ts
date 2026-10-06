import { describe, expect, it } from "vitest";

import { runExclusive } from "./concurrency";

/** Resolves after a macrotask so interleaving is actually possible if the
 * lock didn't serialize the calls. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("runExclusive", () => {
  it("serializes calls sharing a key — no interleaving of their bodies", async () => {
    const events: string[] = [];

    async function task(label: string) {
      return runExclusive("shared-key", async () => {
        events.push(`${label}:start`);
        await tick();
        events.push(`${label}:end`);
        return label;
      });
    }

    const [a, b] = await Promise.all([task("a"), task("b")]);

    expect([a, b]).toEqual(["a", "b"]);
    // If the lock worked, one task's start/end pair never splits the
    // other's — interleaving would produce ["a:start", "b:start", ...].
    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("runs calls with different keys concurrently, not serialized", async () => {
    const events: string[] = [];

    async function task(key: string, label: string) {
      return runExclusive(key, async () => {
        events.push(`${label}:start`);
        await tick();
        events.push(`${label}:end`);
      });
    }

    await Promise.all([task("key-a", "a"), task("key-b", "b")]);

    // Unlike the shared-key case, both starts happen before either end.
    expect(events.slice(0, 2).sort()).toEqual(["a:start", "b:start"]);
  });

  it("releases the lock even when the guarded function throws", async () => {
    await expect(
      runExclusive("err-key", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    // A later call with the same key must not hang behind the failed one.
    const result = await runExclusive("err-key", async () => "recovered");
    expect(result).toBe("recovered");
  });
});
