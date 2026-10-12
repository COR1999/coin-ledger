import { describe, expect, it } from "vitest";
import type { PaymentProposal } from "@/lib/domain/types";
import type { ExecutionResult } from "./execute";
import { describeExecutionOutcome } from "./execution-outcome";

function result(overrides: Partial<ExecutionResult>): ExecutionResult {
  return {
    proposal: {} as PaymentProposal,
    paymentId: "pay-1",
    status: "pending",
    onChainAmount: "0.15 EURC",
    ...overrides,
  };
}

describe("describeExecutionOutcome", () => {
  it("reports an executed payment with its tx hash and the executed status", () => {
    const outcome = describeExecutionOutcome(
      result({ status: "confirmed", txHash: "0xabc" }),
      "confirm",
    );
    expect(outcome).toMatchObject({
      success: true,
      txHash: "0xabc",
      onChainAmount: "0.15 EURC",
      status: "executed",
    });
    expect(outcome.message).toContain("Payment confirmed and executed");
    expect(outcome.message).toContain("0xabc");
  });

  it("reports a failed payment as unsuccessful with the provider's reason", () => {
    const outcome = describeExecutionOutcome(
      result({ status: "failed", failureReason: "DENIED" }),
      "retry",
    );
    expect(outcome).toEqual({
      success: false,
      message: "Retry failed again: DENIED",
      status: "failed",
    });
  });

  it("reports a still-pending payment as executing", () => {
    expect(describeExecutionOutcome(result({}), "approve")).toEqual({
      success: true,
      message: "Payment approved and submitted (pending confirmation).",
      status: "executing",
    });
  });
});
