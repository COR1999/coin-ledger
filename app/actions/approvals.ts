"use server";

import { z } from "zod";
import { evaluateApproval } from "@/lib/policy/engine";
import { executePayment } from "@/lib/payments/execute";
import { getPaymentProvider } from "@/lib/payments/provider";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor } from "@/lib/session";

const proposalIdSchema = z.string().min(1);

const provider = getPaymentProvider();

export interface ActionResult {
  success: boolean;
  message: string;
  proposalId?: string;
  txHash?: string;
}

export async function approveProposal(
  proposalId: string,
): Promise<ActionResult> {
  try {
    proposalIdSchema.parse(proposalId);
    const actor = await getCurrentActor();
    const repos = getRepositories();

    const proposal = await repos.proposals.getById(proposalId);
    if (!proposal) {
      return { success: false, message: "Proposal not found" };
    }

    if (proposal.status !== "pending") {
      return {
        success: false,
        message: `Cannot approve a proposal with status "${proposal.status}"`,
      };
    }

    const policies = await repos.policies.get();
    const approvalCheck = evaluateApproval({
      approverRole: actor.role,
      amountCents: proposal.amountCents,
      policies,
    });

    if (!approvalCheck.permitted) {
      return {
        success: false,
        message: approvalCheck.reasons.join("; "),
      };
    }

    const newStatus = proposal.requiresConfirmation
      ? "awaiting_confirmation"
      : "approved";

    await repos.proposals.update(proposalId, {
      status: newStatus,
      approvedByActorId: actor.id,
    });

    if (newStatus === "approved") {
      try {
        const result = await executePayment(proposalId, repos, provider);
        if (result.status === "confirmed") {
          return {
            success: true,
            message: `Payment approved and executed. Tx: ${result.txHash}`,
            proposalId,
            txHash: result.txHash,
          };
        } else if (result.status === "failed") {
          return {
            success: false,
            message: `Payment approved but execution failed: ${result.failureReason}`,
            proposalId,
          };
        }
        return {
          success: true,
          message: "Payment approved and submitted (pending confirmation).",
          proposalId,
        };
      } catch (error) {
        return {
          success: false,
          message: `Execution error: ${error instanceof Error ? error.message : "Unknown"}`,
          proposalId,
        };
      }
    }

    return {
      success: true,
      message: `Approved. This payment requires confirmation before execution.`,
      proposalId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function confirmProposal(
  proposalId: string,
): Promise<ActionResult> {
  try {
    proposalIdSchema.parse(proposalId);
    const actor = await getCurrentActor();
    const repos = getRepositories();

    const proposal = await repos.proposals.getById(proposalId);
    if (!proposal) {
      return { success: false, message: "Proposal not found" };
    }

    if (
      proposal.status !== "awaiting_confirmation" &&
      proposal.status !== "approved"
    ) {
      return {
        success: false,
        message: `Cannot confirm a proposal with status "${proposal.status}"`,
      };
    }

    await repos.proposals.update(proposalId, {
      status: "confirmed",
      confirmedByActorId: actor.id,
    });

    try {
      const result = await executePayment(proposalId, repos, provider);
      if (result.status === "confirmed") {
        return {
          success: true,
          message: `Payment confirmed and executed. Tx: ${result.txHash}`,
          proposalId,
          txHash: result.txHash,
        };
      } else if (result.status === "failed") {
        return {
          success: false,
          message: `Payment confirmed but execution failed: ${result.failureReason}`,
          proposalId,
        };
      }
      return {
        success: true,
        message: "Payment confirmed and submitted (pending on-chain).",
        proposalId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Execution error: ${error instanceof Error ? error.message : "Unknown"}`,
        proposalId,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function rejectProposal(
  proposalId: string,
): Promise<ActionResult> {
  try {
    proposalIdSchema.parse(proposalId);
    const repos = getRepositories();

    const proposal = await repos.proposals.getById(proposalId);
    if (!proposal) {
      return { success: false, message: "Proposal not found" };
    }

    if (proposal.status === "executed" || proposal.status === "rejected") {
      return {
        success: false,
        message: `Cannot reject a proposal with status "${proposal.status}"`,
      };
    }

    await repos.proposals.update(proposalId, { status: "rejected" });

    return {
      success: true,
      message: "Proposal rejected.",
      proposalId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
