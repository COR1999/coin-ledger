import { DEMO_SCALE_LABEL } from "@/lib/config";
import type { ProposalStatus } from "@/lib/domain/types";
import type { ExecutionResult } from "./execute";

/** Which human action triggered execution; only changes the wording. */
export type ExecutionTrigger = "approve" | "confirm" | "retry";

export interface ExecutionOutcome {
  success: boolean;
  message: string;
  txHash?: string;
  onChainAmount?: string;
  /** The proposal's resulting status, so the UI can show the right next
   * buttons without waiting for a refresh. */
  status: ProposalStatus;
}

const WORDING: Record<
  ExecutionTrigger,
  {
    executed: (r: ExecutionResult) => string;
    failed: (r: ExecutionResult) => string;
    pending: string;
  }
> = {
  approve: {
    executed: (r) =>
      `Payment approved and executed on-chain: ${r.onChainAmount} (${DEMO_SCALE_LABEL}). Tx: ${r.txHash}`,
    failed: (r) => `Payment approved but execution failed: ${r.failureReason}`,
    pending: "Payment approved and submitted (pending confirmation).",
  },
  confirm: {
    executed: (r) =>
      `Payment confirmed and executed on-chain: ${r.onChainAmount} (${DEMO_SCALE_LABEL}). Tx: ${r.txHash}`,
    failed: (r) => `Payment confirmed but execution failed: ${r.failureReason}`,
    pending: "Payment confirmed and submitted (pending on-chain).",
  },
  retry: {
    executed: (r) =>
      `Retry succeeded — executed on-chain: ${r.onChainAmount} (${DEMO_SCALE_LABEL}). Tx: ${r.txHash}`,
    failed: (r) => `Retry failed again: ${r.failureReason}`,
    pending: "Retry submitted (pending on-chain confirmation).",
  },
};

/** Maps a finished executePayment call to what the person who clicked sees. */
export function describeExecutionOutcome(
  result: ExecutionResult,
  trigger: ExecutionTrigger,
): ExecutionOutcome {
  const wording = WORDING[trigger];
  switch (result.status) {
    case "confirmed":
      return {
        success: true,
        message: wording.executed(result),
        txHash: result.txHash,
        onChainAmount: result.onChainAmount,
        status: "executed",
      };
    case "failed":
      return {
        success: false,
        message: wording.failed(result),
        status: "failed",
      };
    case "pending":
      return { success: true, message: wording.pending, status: "executing" };
  }
}
