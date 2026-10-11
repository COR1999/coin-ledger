import { runExclusive } from "@/lib/concurrency";
import { formatOnChainAmount } from "@/lib/config";
import { SEED_TODAY } from "@/lib/data/seed";
import type { Actor, PaymentProposal, Policies } from "@/lib/domain/types";
import {
  committedProposalsCents,
  upcomingObligationsCents,
} from "@/lib/finance/engine";
import {
  LockUnavailableError,
  withDistributedLock,
  type LockStore,
} from "@/lib/distributed-lock";
import { formatCents } from "@/lib/money";
import {
  evaluateApproval,
  evaluatePolicy,
  type PolicyDecision,
} from "@/lib/policy/engine";
import type { Repositories } from "@/lib/repositories/types";
import { computeDecisionHash } from "./decision-receipt";
import { deterministicIdempotencyKey } from "./idempotency";
import type { PaymentProvider, PaymentStatus } from "./types";

/**
 * MockPaymentProvider settles in ~1s, but real Arc/Circle confirmations lag
 * behind chain finality — BUILD_LOG's own disposable verification transfer
 * needed a ~3s poll. A single fixed-delay check left real payments stuck in
 * "executing" forever once confirmation took longer than the wait. Poll
 * instead, up to ~20s, before giving up.
 */
const STATUS_POLL_INTERVAL_MS = 1500;
const STATUS_POLL_MAX_ATTEMPTS = 13;

export class ExecutionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "INVALID_STATUS"
      | "MISSING_APPROVAL"
      | "MISSING_CONFIRMATION"
      | "INVALID_APPROVER"
      | "ALREADY_EXECUTED"
      | "POLICY_REJECTED"
      | "PROVIDER_FAILED"
      | "MISSING_WALLET_ADDRESS"
      | "PAYMENTS_PAUSED"
      | "IN_PROGRESS",
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

export interface ExecutionResult {
  proposal: PaymentProposal;
  paymentId: string;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;
  /** e.g. "2.4 EURC" — always shown next to DEMO_SCALE_LABEL, never bare. */
  onChainAmount: string;
  failureReason?: string;
}

export interface StatusPollOptions {
  intervalMs?: number;
  maxAttempts?: number;
}

export interface ExecutionLock {
  /** Shared store every server instance can see (Redis). */
  store: LockStore;
  /** Proposal ids are only unique per workspace, so the lock key must be
   * scoped by workspace or unrelated workspaces would block each other. */
  scope: string;
}

export interface ExecuteOptions extends StatusPollOptions {
  /** Cross-instance lock. Omit when storage isn't shared (in-memory), where
   * there is no other instance to coordinate with. */
  lock?: ExecutionLock;
}

/**
 * Must exceed one full execution: submit, ~20s of status polling and a
 * dozen storage round-trips. Only matters if the holder dies mid-execution;
 * a normal run releases the lock as soon as it finishes.
 */
const EXECUTION_LOCK_TTL_MS = 60_000;

/**
 * Two concurrent calls for the same proposal (a double-click on Approve, or
 * a retry racing the original request) must not both reach the provider or
 * both mutate the balance. Two layers:
 * - In-process mutex: callers in this instance queue, so the second one sees
 *   the first one's result ("already executed") instead of racing it.
 * - Distributed lock: a caller on another serverless instance is refused
 *   with IN_PROGRESS rather than waiting up to ~20s for the first to finish.
 */
export async function executePayment(
  proposalId: string,
  repos: Repositories,
  provider: PaymentProvider,
  options: ExecuteOptions = {},
): Promise<ExecutionResult> {
  const { lock, ...pollOptions } = options;
  const scope = lock?.scope ?? "local";
  return runExclusive(`execute:${scope}:${proposalId}`, async () => {
    try {
      return await withDistributedLock(
        lock?.store ?? null,
        `lock:execute:${scope}:${proposalId}`,
        { ttlMs: EXECUTION_LOCK_TTL_MS, waitMs: 0, retryDelayMs: 0 },
        () => executePaymentExclusive(proposalId, repos, provider, pollOptions),
      );
    } catch (error) {
      if (error instanceof LockUnavailableError) {
        throw new ExecutionError(
          "This payment is already being processed. Refresh in a moment to see the result.",
          "IN_PROGRESS",
        );
      }
      throw error;
    }
  });
}

async function executePaymentExclusive(
  proposalId: string,
  repos: Repositories,
  provider: PaymentProvider,
  pollOptions: StatusPollOptions,
): Promise<ExecutionResult> {
  const pollIntervalMs = pollOptions.intervalMs ?? STATUS_POLL_INTERVAL_MS;
  const pollMaxAttempts = pollOptions.maxAttempts ?? STATUS_POLL_MAX_ATTEMPTS;
  const proposal = await repos.proposals.getById(proposalId);
  if (!proposal) {
    throw new ExecutionError(`Proposal ${proposalId} not found`, "NOT_FOUND");
  }

  if (proposal.status === "executed") {
    throw new ExecutionError(
      `Proposal ${proposalId} has already been executed`,
      "ALREADY_EXECUTED",
    );
  }

  if (proposal.status === "rejected") {
    throw new ExecutionError(
      `Proposal ${proposalId} has status ${proposal.status} and cannot be executed`,
      "INVALID_STATUS",
    );
  }

  if (
    proposal.policyDecision === "needs_approval" &&
    !proposal.approvedByActorId
  ) {
    throw new ExecutionError(
      `Proposal ${proposalId} requires approval before execution`,
      "MISSING_APPROVAL",
    );
  }

  if (proposal.requiresConfirmation && !proposal.confirmedByActorId) {
    throw new ExecutionError(
      `Proposal ${proposalId} requires confirmation before execution`,
      "MISSING_CONFIRMATION",
    );
  }

  const [
    business,
    supplier,
    policies,
    todaySpentByBusiness,
    todaySpentByActor,
    actors,
    obligations,
    proposals,
  ] = await Promise.all([
    repos.business.get(),
    repos.suppliers.getById(proposal.supplierId),
    repos.policies.get(),
    repos.transactions.spentOnDateCents(SEED_TODAY),
    repos.transactions.spentOnDateByActorCents(
      SEED_TODAY,
      proposal.proposedByActorId,
    ),
    repos.actors.list(),
    repos.obligations.list(),
    repos.proposals.list(),
  ]);

  if (!supplier) {
    throw new ExecutionError(
      `Supplier ${proposal.supplierId} not found`,
      "NOT_FOUND",
    );
  }

  // Owner's emergency circuit breaker. Checked here — the one server-side
  // path that actually moves money — rather than only at proposal-creation
  // time, so toggling it mid-flight stops an already-approved or already-
  // confirmed proposal too, not just new ones. Deliberately does not change
  // the proposal's own status (not a policy rejection of *this* proposal —
  // it's a business-wide halt); unpausing lets a normal retry/re-confirm
  // proceed exactly as if execution had simply been delayed.
  if (policies.paymentsPaused) {
    throw new ExecutionError(
      "All payments are currently paused for this business",
      "PAYMENTS_PAUSED",
    );
  }

  const proposer = actors.find((a) => a.id === proposal.proposedByActorId);
  if (!proposer) {
    throw new ExecutionError(
      `Unknown proposer: ${proposal.proposedByActorId}`,
      "NOT_FOUND",
    );
  }
  const obligationsNext30Days = upcomingObligationsCents(
    obligations,
    SEED_TODAY,
    30,
  );

  const policyResult = evaluatePolicy({
    amountCents: proposal.amountCents,
    actor: proposer,
    supplier,
    businessState: {
      balanceCents: business.currentBalanceCents,
      obligationsNext30DaysCents: obligationsNext30Days,
      todaySpentByActorCents: todaySpentByActor,
      todaySpentByBusinessCents: todaySpentByBusiness,
      // Exclude this proposal's own id — its in-flight status (approved,
      // awaiting_confirmation, confirmed) would otherwise double-count
      // against itself in the safe-to-spend re-check.
      committedPendingCents: committedProposalsCents(proposals, proposalId),
    },
    policies,
  });

  // Captured the moment the re-check actually decided — this, not the
  // eventual execution time, is what the receipt attests to: "these were
  // the rules and this was the verdict when the money was authorized to
  // move," regardless of how long the provider then takes to settle.
  const decisionHash = computeDecisionHash({
    proposalId,
    supplierId: supplier.id,
    amountCents: proposal.amountCents,
    actorId: proposer.id,
    decision: policyResult.decision,
    minimumReserveCents: policies.minimumReserveCents,
    businessDailyLimitCents: policies.businessDailyLimitCents,
    confirmationThresholdCents: policies.confirmationThresholdCents,
    decidedAt: new Date().toISOString(),
  });

  // Resume rather than resubmit: if an earlier call already reached the
  // provider (paymentId stored) and the proposal is still "executing", the
  // outcome is unknown, not failed — a prior poll may simply have exhausted
  // its attempts, or the process may have been interrupted mid-poll.
  // Submitting again with a fresh idempotency key would risk a genuine
  // double payment; polling the same paymentId again is always safe.
  const resuming = proposal.status === "executing" && !!proposal.paymentId;

  // The authorization gates below decide whether money may *start* moving.
  // A resumed payment was already authorized and submitted, so its on-chain
  // outcome must still be recorded even if the rules have since changed —
  // marking it "rejected" here would leave a payment that may have settled
  // permanently missing from the ledger and balance.
  if (!resuming) {
    await enforcePolicyVerdict(proposal, policyResult, actors, policies, repos);
  }

  if (!supplier.walletAddress) {
    throw new ExecutionError(
      `Supplier ${supplier.id} has no on-chain wallet address`,
      "MISSING_WALLET_ADDRESS",
    );
  }

  let paymentId: string;

  if (resuming) {
    paymentId = proposal.paymentId!;
  } else {
    const attemptNumber = proposal.attempts + 1;
    // Conditional on the status read at the top: a reject (or anything
    // else) that landed since must win, not be overwritten by "executing".
    const claimed = await repos.proposals.updateIfStatus(
      proposalId,
      [proposal.status],
      { status: "executing", attempts: attemptNumber },
    );
    if (!claimed) {
      throw new ExecutionError(
        `Proposal ${proposalId} changed while it was being executed; nothing was sent`,
        "INVALID_STATUS",
      );
    }

    const idempotencyKey = deterministicIdempotencyKey(
      `proposal-${proposalId}-${proposal.createdAt}-attempt-${attemptNumber}`,
    );

    try {
      const submitResult = await provider.submit({
        idempotencyKey,
        to: supplier.walletAddress,
        amount: formatCents(proposal.amountCents),
        currency: "EURC",
      });
      paymentId = submitResult.paymentId;
      await repos.proposals.update(proposalId, { paymentId });
    } catch (error) {
      // Nothing was accepted by the provider — safe to mark failed; a later
      // retry submits fresh with a new idempotency key.
      await repos.proposals.update(proposalId, {
        status: "failed",
        failureReason:
          error instanceof Error ? error.message : "Unknown provider error",
      });
      throw new ExecutionError(
        `Payment provider error: ${error instanceof Error ? error.message : "Unknown"}`,
        "PROVIDER_FAILED",
      );
    }
  }

  let status: PaymentStatus;
  try {
    status = { status: "pending" };
    for (let attempt = 0; attempt < pollMaxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      status = await provider.getStatus(paymentId);
      if (status.status !== "pending") break;
    }
  } catch (error) {
    // The provider accepted the payment but its outcome can't be read right
    // now — leave the proposal in "executing" with paymentId set so the next
    // call resumes polling instead of resubmitting or being marked failed
    // for a payment that may have actually gone through.
    throw new ExecutionError(
      `Payment provider error while checking status: ${error instanceof Error ? error.message : "Unknown"}`,
      "PROVIDER_FAILED",
    );
  }

  if (status.status === "confirmed") {
    await repos.proposals.update(proposalId, {
      status: "executed",
      txHash: status.txHash,
    });
    await repos.business.adjustBalanceCents(-proposal.amountCents);
    await repos.transactions.add({
      id: `tx-exec-${proposalId}`,
      date: SEED_TODAY,
      // Several executions can share the same display `date` (the fixed
      // demo-anchor date) — createdAt is the real moment of execution, so
      // recentTransactions can still sort them in true chronological order.
      createdAt: new Date().toISOString(),
      description: `${supplier.name} — ${proposal.reason}`,
      category: "Supplier",
      amountCents: -proposal.amountCents,
      supplierId: supplier.id,
      txHash: status.txHash,
      proposalId: proposal.id,
      proposedByActorId: proposal.proposedByActorId,
      decisionHash,
    });
  } else if (status.status === "failed") {
    await repos.proposals.update(proposalId, {
      status: "failed",
      failureReason: status.failureReason,
    });
  }
  // else still "pending": leave status "executing" with paymentId set —
  // resumable by a later call (e.g. the Retry action) instead of lost.

  const updatedProposal = await repos.proposals.getById(proposalId);
  return {
    proposal: updatedProposal!,
    paymentId,
    status: status.status,
    txHash: status.txHash,
    onChainAmount: formatOnChainAmount(proposal.amountCents),
    failureReason: status.failureReason,
  };
}

/**
 * Enforces the live re-check's verdict, not the one stored on the proposal
 * when it was created. Policies can change between proposal and execution
 * (an owner lowers a role's limit or the confirmation threshold), so a
 * proposal stored as "allowed" may now need approval or confirmation that
 * nobody has given. Fails closed: throws before anything reaches the
 * provider, after moving the proposal into the state where a human can give
 * the missing approval or confirmation (or reject it).
 */
async function enforcePolicyVerdict(
  proposal: PaymentProposal,
  policyResult: PolicyDecision,
  actors: Actor[],
  policies: Policies,
  repos: Repositories,
): Promise<void> {
  if (policyResult.decision === "rejected") {
    await repos.proposals.update(proposal.id, {
      status: "rejected",
      failureReason: policyResult.reasons.join("; "),
    });
    throw new ExecutionError(
      `Policy re-check rejected: ${policyResult.reasons.join("; ")}`,
      "POLICY_REJECTED",
    );
  }

  if (policyResult.decision === "needs_approval") {
    if (!proposal.approvedByActorId) {
      // Back into the approval queue rather than left in a state with no
      // matching action: an approver can now approve or reject it there.
      await repos.proposals.update(proposal.id, {
        status: "pending",
        policyDecision: "needs_approval",
        requiredApproverRole: policyResult.requiredApproverRole,
        requiresConfirmation: policyResult.requiresConfirmation,
      });
      throw new ExecutionError(
        `Policies changed since this payment was proposed: ${policyResult.reasons.join("; ")}. It has been returned to the approval queue.`,
        "MISSING_APPROVAL",
      );
    }
    const approverActor = actors.find(
      (a) => a.id === proposal.approvedByActorId,
    );
    if (!approverActor) {
      throw new ExecutionError(
        `Unknown approver: ${proposal.approvedByActorId}`,
        "INVALID_APPROVER",
      );
    }
    const approvalCheck = evaluateApproval({
      approverRole: approverActor.role,
      amountCents: proposal.amountCents,
      policies,
    });
    if (!approvalCheck.permitted) {
      throw new ExecutionError(
        `Approver not authorized: ${approvalCheck.reasons.join("; ")}`,
        "INVALID_APPROVER",
      );
    }
  }

  if (policyResult.requiresConfirmation && !proposal.confirmedByActorId) {
    await repos.proposals.update(proposal.id, {
      status: "awaiting_confirmation",
      requiresConfirmation: true,
    });
    throw new ExecutionError(
      "Policies changed since this payment was proposed: it is now above the confirmation threshold and is waiting for confirmation.",
      "MISSING_CONFIRMATION",
    );
  }
}
