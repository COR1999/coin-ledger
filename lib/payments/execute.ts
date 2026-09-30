import { SEED_TODAY, seedActors } from "@/lib/data/seed";
import type { PaymentProposal } from "@/lib/domain/types";
import { upcomingObligationsCents } from "@/lib/finance/engine";
import { formatCents } from "@/lib/money";
import { evaluateApproval, evaluatePolicy } from "@/lib/policy/engine";
import { getSeedObligations } from "@/lib/repositories/in-memory";
import type { Repositories } from "@/lib/repositories/types";
import { deterministicIdempotencyKey } from "./idempotency";
import type { PaymentProvider } from "./types";

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
  failureReason?: string;
}

export async function executePayment(
  proposalId: string,
  repos: Repositories,
  provider: PaymentProvider,
): Promise<ExecutionResult> {
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

  if (proposal.status === "failed" || proposal.status === "rejected") {
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

  const [business, supplier, policies, todaySpentByBusiness] =
    await Promise.all([
      repos.business.get(),
      repos.suppliers.getById(proposal.supplierId),
      repos.policies.get(),
      repos.transactions.spentOnDateCents(SEED_TODAY),
    ]);

  if (!supplier) {
    throw new ExecutionError(
      `Supplier ${proposal.supplierId} not found`,
      "NOT_FOUND",
    );
  }

  const proposer = seedActors.find((a) => a.id === proposal.proposedByActorId);
  if (!proposer) {
    throw new ExecutionError(
      `Unknown proposer: ${proposal.proposedByActorId}`,
      "NOT_FOUND",
    );
  }
  const obligations = getSeedObligations();
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
      todaySpentByActorCents: 0,
      todaySpentByBusinessCents: todaySpentByBusiness,
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
    const approverActor = seedActors.find(
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

  await repos.proposals.update(proposalId, { status: "executing" });

  const idempotencyKey = deterministicIdempotencyKey(`proposal-${proposalId}`);

  try {
    const submitResult = await provider.submit({
      idempotencyKey,
      to: supplier.walletAddress,
      amount: formatCents(proposal.amountCents),
      currency: "EURC",
    });

    await repos.proposals.update(proposalId, {
      paymentId: submitResult.paymentId,
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const status = await provider.getStatus(submitResult.paymentId);

    if (status.status === "confirmed") {
      await repos.proposals.update(proposalId, {
        status: "executed",
        txHash: status.txHash,
      });
      await repos.business.setBalanceCents(
        business.currentBalanceCents - proposal.amountCents,
      );
      await repos.transactions.add({
        id: `tx-exec-${proposalId}`,
        date: SEED_TODAY,
        description: `${supplier.name} — ${proposal.reason}`,
        category: "Supplier",
        amountCents: -proposal.amountCents,
        supplierId: supplier.id,
      });
    } else if (status.status === "failed") {
      await repos.proposals.update(proposalId, {
        status: "failed",
        failureReason: status.failureReason,
      });
    }

    const updatedProposal = await repos.proposals.getById(proposalId);
    return {
      proposal: updatedProposal!,
      paymentId: submitResult.paymentId,
      status: status.status,
      txHash: status.txHash,
      failureReason: status.failureReason,
    };
  } catch (error) {
    if (error instanceof ExecutionError) throw error;
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
