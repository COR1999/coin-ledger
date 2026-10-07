"use server";

import { z } from "zod";
import { DEMO_SCALE_LABEL } from "@/lib/config";
import type { ProposalStatus } from "@/lib/domain/types";
import { env } from "@/lib/env";
import { formatEuros } from "@/lib/money";
import { sendApprovalNotification } from "@/lib/notify/webhook";
import { evaluateApproval } from "@/lib/policy/engine";
import { executePayment } from "@/lib/payments/execute";
import { getPaymentProvider } from "@/lib/payments/provider";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";

const proposalIdSchema = z.string().min(1);

/** Same resolution as app/api/chat/route.ts's own copy — see that file's
 * comment. Small enough, and used from few enough places, that a shared
 * helper isn't worth the extra indirection; duplicated deliberately rather
 * than importing one route's helper into another. */
function resolveAppBaseUrl(): string | undefined {
  if (env.APP_BASE_URL) return env.APP_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

export interface ActionResult {
  success: boolean;
  message: string;
  proposalId?: string;
  txHash?: string;
  onChainAmount?: string;
  /**
   * The proposal's actual resulting status, whenever it actually changed —
   * lets the client show the real next state immediately instead of
   * guessing from txHash alone or waiting on `router.refresh()`'s round
   * trip, which was found live (2026-10-06) to leave the UI stuck on a
   * vague "Updating…" with no action buttons for several seconds after an
   * approve that still needed confirmation. Included on `success: false`
   * too when the proposal's status genuinely moved server-side — a
   * permission check failing before any mutation leaves this unset (nothing
   * changed, `p.status` is still accurate), but an execution that fails
   * *after* `executePayment` already persisted `status: "failed"` must
   * report it, or the UI shows stale pre-action buttons for the same
   * staleness-window reason the success path was fixed for.
   */
  status?: ProposalStatus;
}

export async function approveProposal(
  proposalId: string,
): Promise<ActionResult> {
  try {
    proposalIdSchema.parse(proposalId);
    const workspaceId = await getCurrentWorkspaceId();
    const actor = await getCurrentActor();
    const repos = getRepositories(workspaceId);
    const provider = getPaymentProvider(workspaceId);

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
            message: `Payment approved and executed on-chain: ${result.onChainAmount} (${DEMO_SCALE_LABEL}). Tx: ${result.txHash}`,
            proposalId,
            txHash: result.txHash,
            onChainAmount: result.onChainAmount,
            status: "executed",
          };
        } else if (result.status === "failed") {
          return {
            success: false,
            message: `Payment approved but execution failed: ${result.failureReason}`,
            proposalId,
            status: "failed",
          };
        }
        return {
          success: true,
          message: "Payment approved and submitted (pending confirmation).",
          proposalId,
          status: "executing",
        };
      } catch (error) {
        return {
          success: false,
          message: `Execution error: ${error instanceof Error ? error.message : "Unknown"}`,
          proposalId,
        };
      }
    }

    // A second, distinct human-actionable state from "pending" — the agent
    // already notified once at proposal creation (lib/agent/tools.ts), but
    // that was about needing *approval*; needing *confirmation* is a
    // separate ask, often of a different role (a higher approval limit),
    // and was previously silent — the owner-configured notification channel
    // only ever fired once per proposal regardless of how many distinct
    // human actions it actually needed.
    if (policies.notificationWebhookUrl) {
      const supplier = await repos.suppliers.getById(proposal.supplierId);
      const appBaseUrl = resolveAppBaseUrl();
      await sendApprovalNotification(policies.notificationWebhookUrl, {
        supplierName: supplier?.name ?? proposal.supplierId,
        amountDisplay: formatEuros(proposal.amountCents),
        reason: proposal.reason,
        actorName: actor.name,
        verb: "approved",
        action: "confirmation",
        approvalsUrl: appBaseUrl ? `${appBaseUrl}/approvals` : "/approvals",
      });
    }

    return {
      success: true,
      message: `Approved. This payment requires confirmation before execution.`,
      proposalId,
      status: "awaiting_confirmation",
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
    const workspaceId = await getCurrentWorkspaceId();
    const actor = await getCurrentActor();
    const repos = getRepositories(workspaceId);
    const provider = getPaymentProvider(workspaceId);

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

    // Confirmation is the deliberate human check before money moves — the
    // same authority bound as approving: only a role whose approval limit
    // covers this amount may confirm it. Without this, the action was
    // directly callable by any actor (e.g. an employee confirming a payment
    // an accountant proposed), unlike every other mutating action here.
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

    await repos.proposals.update(proposalId, {
      status: "confirmed",
      confirmedByActorId: actor.id,
    });

    try {
      const result = await executePayment(proposalId, repos, provider);
      if (result.status === "confirmed") {
        return {
          success: true,
          message: `Payment confirmed and executed on-chain: ${result.onChainAmount} (${DEMO_SCALE_LABEL}). Tx: ${result.txHash}`,
          proposalId,
          txHash: result.txHash,
          onChainAmount: result.onChainAmount,
          status: "executed",
        };
      } else if (result.status === "failed") {
        return {
          success: false,
          message: `Payment confirmed but execution failed: ${result.failureReason}`,
          proposalId,
          status: "failed",
        };
      }
      return {
        success: true,
        message: "Payment confirmed and submitted (pending on-chain).",
        proposalId,
        status: "executing",
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

export async function retryPayment(proposalId: string): Promise<ActionResult> {
  try {
    proposalIdSchema.parse(proposalId);
    const workspaceId = await getCurrentWorkspaceId();
    const actor = await getCurrentActor();
    const repos = getRepositories(workspaceId);
    const provider = getPaymentProvider(workspaceId);

    const proposal = await repos.proposals.getById(proposalId);
    if (!proposal) {
      return { success: false, message: "Proposal not found" };
    }

    // "approved"/"confirmed" are normally transient — the request that sets
    // them immediately calls executePayment in the same server action. If
    // that call never ran (e.g. the proposal was created by the chat agent
    // but a later turn in the same request crashed before reaching
    // auto-execute), the proposal is stuck there with no failureReason and
    // no other recovery path, so retry covers it the same as "failed".
    // "executing" covers the case where a prior call submitted the payment
    // but the confirmation poll exhausted its attempts (or the server was
    // interrupted) before learning the outcome — executePayment resumes by
    // polling the same paymentId rather than submitting a second payment.
    const retryableStatuses = ["failed", "approved", "confirmed", "executing"];
    if (!retryableStatuses.includes(proposal.status)) {
      return {
        success: false,
        message: `Cannot retry a proposal with status "${proposal.status}"`,
      };
    }

    // Retrying resubmits the same payment to the provider — the same
    // authority check approveProposal enforces applies here: only a role
    // whose approval limit covers this amount may trigger it. Without this,
    // the Retry server action was directly callable by any actor regardless
    // of the UI's owner/accountant-only button gating.
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

    try {
      const result = await executePayment(proposalId, repos, provider);
      if (result.status === "confirmed") {
        return {
          success: true,
          message: `Retry succeeded — executed on-chain: ${result.onChainAmount} (${DEMO_SCALE_LABEL}). Tx: ${result.txHash}`,
          proposalId,
          txHash: result.txHash,
          onChainAmount: result.onChainAmount,
          status: "executed",
        };
      } else if (result.status === "failed") {
        return {
          success: false,
          message: `Retry failed again: ${result.failureReason}`,
          proposalId,
          status: "failed",
        };
      }
      return {
        success: true,
        message: "Retry submitted (pending on-chain confirmation).",
        proposalId,
        status: "executing",
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
    const repos = getRepositories(await getCurrentWorkspaceId());

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
      status: "rejected",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
