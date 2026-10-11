import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  GENERIC_ACTION_ERROR,
  INVALID_INPUT_ERROR,
  toActionErrorMessage,
} from "./action-error";
import { ExecutionError } from "./payments/execute";

describe("toActionErrorMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes an ExecutionError's message through to the user", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new ExecutionError("Payments are paused", "PAYMENTS_PAUSED");
    expect(toActionErrorMessage(error, "approve")).toBe("Payments are paused");
  });

  it("hides a validation error's internals behind a plain message", () => {
    const parsed = z.string().min(1).safeParse("");
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(toActionErrorMessage(parsed.error, "approve")).toBe(
      INVALID_INPUT_ERROR,
    );
  });

  it("logs an unexpected error and returns a generic message", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("connect ECONNREFUSED 10.0.0.5:6379");
    const message = toActionErrorMessage(error, "approve");
    expect(message).toBe(GENERIC_ACTION_ERROR);
    expect(message).not.toContain("10.0.0.5");
    expect(log).toHaveBeenCalledWith(
      "approve failed:",
      expect.objectContaining({ message: error.message }),
    );
  });
});
