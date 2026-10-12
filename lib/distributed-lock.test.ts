import { describe, expect, it, vi } from "vitest";
import {
  createInMemoryLockStore,
  LockUnavailableError,
  withDistributedLock,
  type LockStore,
} from "./distributed-lock";

const FAIL_FAST = { ttlMs: 1_000, waitMs: 0, retryDelayMs: 1 };

describe("withDistributedLock", () => {
  it("just runs the work when no store is configured", async () => {
    await expect(
      withDistributedLock(null, "k", FAIL_FAST, async () => 42),
    ).resolves.toBe(42);
  });

  it("refuses a second holder while the first still holds the lock", async () => {
    const store = createInMemoryLockStore();
    let release!: () => void;
    const first = withDistributedLock(
      store,
      "k",
      FAIL_FAST,
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    await Promise.resolve();

    await expect(
      withDistributedLock(store, "k", FAIL_FAST, async () => "second"),
    ).rejects.toBeInstanceOf(LockUnavailableError);

    release();
    await first;
    await expect(
      withDistributedLock(store, "k", FAIL_FAST, async () => "third"),
    ).resolves.toBe("third");
  });

  it("waits for the holder to finish when a wait budget is given", async () => {
    const store = createInMemoryLockStore();
    const order: string[] = [];
    const first = withDistributedLock(store, "k", FAIL_FAST, async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("first");
    });
    await Promise.resolve();
    const second = withDistributedLock(
      store,
      "k",
      { ttlMs: 1_000, waitMs: 1_000, retryDelayMs: 2 },
      async () => {
        order.push("second");
      },
    );
    await Promise.all([first, second]);
    expect(order).toEqual(["first", "second"]);
  });

  it("does not block unrelated keys", async () => {
    const store = createInMemoryLockStore();
    let release!: () => void;
    const first = withDistributedLock(
      store,
      "a",
      FAIL_FAST,
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    await Promise.resolve();
    await expect(
      withDistributedLock(store, "b", FAIL_FAST, async () => "ok"),
    ).resolves.toBe("ok");
    release();
    await first;
  });

  it("releases the lock when the work throws", async () => {
    const store = createInMemoryLockStore();
    await expect(
      withDistributedLock(store, "k", FAIL_FAST, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(
      withDistributedLock(store, "k", FAIL_FAST, async () => "free"),
    ).resolves.toBe("free");
  });

  it("lets a new holder in once a crashed holder's TTL expires", async () => {
    const store = createInMemoryLockStore();
    await store.tryAcquireLock("k", "crashed-holder", 5);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(
      withDistributedLock(store, "k", FAIL_FAST, async () => "recovered"),
    ).resolves.toBe("recovered");
  });

  it("returns the work's result even if releasing the lock fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store: LockStore = {
      tryAcquireLock: async () => true,
      releaseLock: async () => {
        throw new Error("redis down");
      },
    };
    await expect(
      withDistributedLock(store, "k", FAIL_FAST, async () => "done"),
    ).resolves.toBe("done");
    vi.restoreAllMocks();
  });
});
