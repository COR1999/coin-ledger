import { formatOnChainAmount } from "@/lib/config";
import { SEED_TODAY } from "@/lib/data/seed";
import type { PaymentProposal } from "@/lib/domain/types";
import {
  committedProposalsCents,
  upcomingObligationsCents,
} from "@/lib/finance/engine";
import { formatCents } from "@/lib/money";
import { evaluateApproval, evaluatePolicy } from "@/lib/policy/engine";
import type { Repositories } from "@/lib/repositories/types";
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
      | "MISSING_WALLET_ADDRESS",
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

/**
 * Per-proposal execution lock. Two concurrent calls for the same proposal
 * (a double-click on Approve, or a retry racing the original request) must
 * not both reach the provider or both mutate the balance — every in-memory
 * repository here is a plain object with no locking of its own, so without
 * this, two interleaved calls can each pass the status guards before either
 * writes "executing" and both submit/execute independently. Keyed by
 * proposalId only; unrelated proposals still execute concurrently.
 */
const proposalLocks = new Map<string, Promise<unknown>>();

function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = proposalLocks.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.catch(() => undefined);
  proposalLocks.set(key, tail);
  tail.finally(() => {
    if (proposalLocks.get(key) === tail) proposalLocks.delete(key);
  });
  return run;
}

export async function executePayment(
  proposalId: string,
  repos: Repositories,
  provider: PaymentProvider,
  pollOptions: StatusPollOptions = {},
): Promise<ExecutionResult> {
  return runExclusive(proposalId, () =>
    executePaymentExclusive(proposalId, repos, provider, pollOptions),
  );
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

  if (policyResult.decision === "rejected") {
    await repos.proposals.update(proposalId, {
      status: "rejected",
      failureReason: policyResult.reasons.join("; "),
    });
    throw new ExecutionError(
      `Policy re-check rejected: ${policyResult.reasons.join("; ")}`,
      "POLICY_REJECTED",
    );
  }

  if (
    policyResult.decision === "needs_approval" &&
    proposal.approvedByActorId
  ) {
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

  if (!supplier.walletAddress) {
    throw new ExecutionError(
      `Supplier ${supplier.id} has no on-chain wallet address`,
      "MISSING_WALLET_ADDRESS",
    );
  }

  // Resume rather than resubmit: if an earlier call already reached the
  // provider (paymentId stored) and the proposal is still "executing", the
  // outcome is unknown, not failed — a prior poll may simply have exhausted
  // its attempts, or the process may have been interrupted mid-poll.
  // Submitting again with a fresh idempotency key would risk a genuine
  // double payment; polling the same paymentId again is always safe.
  const resuming = proposal.status === "executing" && !!proposal.paymentId;
  let paymentId: string;

  if (resuming) {
    paymentId = proposal.paymentId!;
  } else {
    const attemptNumber = proposal.attempts + 1;
    await repos.proposals.update(proposalId, {
      status: "executing",
      attempts: attemptNumber,
    });

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
