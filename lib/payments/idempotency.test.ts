import { describe, expect, it } from "vitest";

import { deterministicIdempotencyKey } from "./idempotency";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("deterministicIdempotencyKey", () => {
  it("is shaped like a UUID v4", () => {
    expect(deterministicIdempotencyKey("proposal-1")).toMatch(UUID_V4_RE);
  });

  it("is deterministic: the same seed always produces the same key", () => {
    expect(deterministicIdempotencyKey("proposal-1")).toBe(
      deterministicIdempotencyKey("proposal-1"),
    );
  });

  it("differs for different seeds", () => {
    expect(deterministicIdempotencyKey("proposal-1")).not.toBe(
      deterministicIdempotencyKey("proposal-2"),
    );
  });
});
