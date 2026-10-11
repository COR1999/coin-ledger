"use server";

import { z } from "zod";
import { toActionErrorMessage } from "@/lib/action-error";
import type { ProposalStatus } from "@/lib/domain/types";
import { env } from "@/lib/env";
import { formatEuros } from "@/lib/money";
import { sendApprovalNotification } from "@/lib/notify/webhook";
import { evaluateApproval } from "@/lib/policy/engine";
import { executePayment } from "@/lib/payments/execute";
import { getExecutionLock } from "@/lib/payments/execution-lock";
import {
  describeExecutionOutcome,
  type ExecutionTrigger,
} from "@/lib/payments/execution-outcome";
import { getPaymentProvider } from "@/lib/payments/provider";
import type { PaymentProvider } from "@/lib/payments/types";
import {
  evaluateRejection,
  REJECTABLE_STATUSES,
} from "@/lib/payments/rejection";
import { getRepositories } from "@/lib/repositories/singleton";
import type { Repositories } from "@/lib/repositories/types";
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

/** Another request changed this proposal between our read and our write
 * (a double-click, or two people acting at once). Nothing was written; the
 * page should refresh to show the real current state. */
function staleProposalResult(proposalId: string): ActionResult {
  return {
    success: false,
    message:
      "This payment was just updated by another action. Refresh to see its current status.",
    proposalId,
  };
}

/** Runs the one server-side execution path and reports the outcome in the
 * shape the approvals UI expects. */
async function executeAndReport(
  proposalId: string,
  workspaceId: string,
  repos: Repositories,
  provider: PaymentProvider,
  trigger: ExecutionTrigger,
): Promise<ActionResult> {
  try {
    const result = await executePayment(proposalId, repos, provider, {
      lock: getExecutionLock(workspaceId),
    });
    return { ...describeExecutionOutcome(result, trigger), proposalId };
  } catch (error) {
    return {
      success: false,
      message: `Execution error: ${toActionErrorMessage(error, "executePayment")}`,
      proposalId,
    };
  }
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

    const approved = await repos.proposals.updateIfStatus(
      proposalId,
      ["pending"],
      { status: newStatus, approvedByActorId: actor.id },
    );
    if (!approved) return staleProposalResult(proposalId);

    if (newStatus === "approved") {
      return executeAndReport(
        proposalId,
        workspaceId,
        repos,
        provider,
        "approve",
      );
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
      message: toActionErrorMessage(error, "approveProposal"),
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

    const confirmed = await repos.proposals.updateIfStatus(
      proposalId,
      ["awaiting_confirmation", "approved"],
      { status: "confirmed", confirmedByActorId: actor.id },
    );
    if (!confirmed) return staleProposalResult(proposalId);

    return executeAndReport(
      proposalId,
      workspaceId,
      repos,
      provider,
      "confirm",
    );
  } catch (error) {
    return {
      success: false,
      message: toActionErrorMessage(error, "confirmProposal"),
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

    return executeAndReport(proposalId, workspaceId, repos, provider, "retry");
  } catch (error) {
    return {
      success: false,
      message: toActionErrorMessage(error, "retryPayment"),
    };
  }
}

export async function rejectProposal(
  proposalId: string,
): Promise<ActionResult> {
  try {
    proposalIdSchema.parse(proposalId);
    const workspaceId = await getCurrentWorkspaceId();
    const actor = await getCurrentActor();
    const repos = getRepositories(workspaceId);

    const proposal = await repos.proposals.getById(proposalId);
    if (!proposal) {
      return { success: false, message: "Proposal not found" };
    }

    // Same server-side role check as approve/confirm/retry: the UI only
    // shows Reject to approvers, but the action itself is directly callable.
    // Also refuses payments already submitted to the provider (see
    // lib/payments/rejection.ts).
    const rejectionCheck = evaluateRejection({
      actorRole: actor.role,
      proposal,
      policies: await repos.policies.get(),
    });
    if (!rejectionCheck.permitted) {
      return { success: false, message: rejectionCheck.reasons.join("; ") };
    }

    const rejected = await repos.proposals.updateIfStatus(
      proposalId,
      REJECTABLE_STATUSES,
      { status: "rejected" },
    );
    if (!rejected) return staleProposalResult(proposalId);

    return {
      success: true,
      message: "Proposal rejected.",
      proposalId,
      status: "rejected",
    };
  } catch (error) {
    return {
      success: false,
      message: toActionErrorMessage(error, "rejectProposal"),
    };
  }
}
