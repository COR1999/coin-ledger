/**
 * Policy engine. Pure, deterministic TypeScript: no React, Next.js, database or
 * LLM dependencies. Given a proposed payment, the actor, the current business
 * state and the policies, it decides whether the payment is allowed, needs
 * approval, or is rejected, and explains why. Clean enough to publish as a
 * reusable package.
 *
 * Decision rules (from docs/spec/policy.md), evaluated so that every applicable
 * reason is reported:
 *   1. Any business-wide rule broken            -> rejected
 *   2. Amount above the owner's single-payment max -> rejected
 *   3. Employee paying a non-approved supplier   -> rejected
 *   4. Role exceeding its own daily limit        -> rejected
 *   5. Actor's single-payment limit exceeded (but <= owner max) -> needs_approval
 *   6. Otherwise                                 -> allowed
 *   8. requiresConfirmation = amount > confirmation threshold
 */
import type {
  Actor,
  Decision,
  Policies,
  Role,
  Supplier,
} from "@/lib/domain/types";
import { formatEuros } from "@/lib/money";

export interface PolicyBusinessState {
  balanceCents: number;
  obligationsNext30DaysCents: number;
  /** Total the acting actor has already paid today. */
  todaySpentByActorCents: number;
  /** Total the whole business has already paid today. */
  todaySpentByBusinessCents: number;
}

export interface PolicyInput {
  amountCents: number;
  actor: Actor;
  supplier: Supplier;
  businessState: PolicyBusinessState;
  policies: Policies;
}

export interface PolicyDecision {
  decision: Decision;
  requiredApproverRole?: Extract<Role, "owner" | "accountant">;
  requiresConfirmation: boolean;
  reasons: string[];
}

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const { amountCents, actor, supplier, businessState, policies } = input;
  const roleLimits = policies.roles[actor.role];
  const ownerMax = policies.roles.owner.maxSinglePaymentCents;
  const requiresConfirmation =
    amountCents > policies.confirmationThresholdCents;

  const rejections: string[] = [];

  // Rule 1 — business-wide rules.
  const safeToSpend =
    businessState.balanceCents -
    businessState.obligationsNext30DaysCents -
    policies.minimumReserveCents;
  if (amountCents > safeToSpend) {
    rejections.push(
      `Exceeds safe-to-spend of ${formatEuros(safeToSpend)} (would breach the ${formatEuros(
        policies.minimumReserveCents,
      )} minimum reserve)`,
    );
  }

  if (
    businessState.todaySpentByBusinessCents + amountCents >
    policies.businessDailyLimitCents
  ) {
    rejections.push(
      `Exceeds the business daily limit of ${formatEuros(policies.businessDailyLimitCents)}`,
    );
  }

  if (
    supplier.monthlyLimitCents !== null &&
    supplier.spentThisMonthCents + amountCents > supplier.monthlyLimitCents
  ) {
    rejections.push(
      `Exceeds ${supplier.name}'s monthly limit of ${formatEuros(supplier.monthlyLimitCents)}`,
    );
  }

  // Rule 2 — above the owner's single-payment maximum (the hard ceiling).
  if (amountCents > ownerMax) {
    rejections.push(
      `Exceeds the maximum single payment of ${formatEuros(ownerMax)}`,
    );
  }

  // Rule 3 — employee paying a supplier that is not on the approved list.
  if (roleLimits.restrictedToApprovedSuppliers && !supplier.employeeApproved) {
    rejections.push(
      `${supplier.name} is not on the approved supplier list for ${actor.name}`,
    );
  }

  // Rule 4 — role exceeding its own daily limit. Only applies to payments the
  // actor could self-authorize (within their single-payment limit); larger
  // amounts escalate to approval instead, where a different authority answers.
  if (
    roleLimits.dailyLimitCents !== null &&
    amountCents <= roleLimits.maxSinglePaymentCents &&
    businessState.todaySpentByActorCents + amountCents >
      roleLimits.dailyLimitCents
  ) {
    rejections.push(
      `Exceeds ${actor.name}'s daily limit of ${formatEuros(roleLimits.dailyLimitCents)}`,
    );
  }

  if (rejections.length > 0) {
    return { decision: "rejected", requiresConfirmation, reasons: rejections };
  }

  // Rule 5 — single-payment limit exceeded but within the owner max: escalate.
  if (amountCents > roleLimits.maxSinglePaymentCents) {
    const requiredApproverRole =
      amountCents <= policies.roles.accountant.maxSinglePaymentCents
        ? "accountant"
        : "owner";
    return {
      decision: "needs_approval",
      requiredApproverRole,
      requiresConfirmation,
      reasons: [
        `Exceeds ${actor.name}'s ${formatEuros(
          roleLimits.maxSinglePaymentCents,
        )} single-payment limit; requires ${requiredApproverRole} approval`,
      ],
    };
  }

  // Rule 6 — allowed.
  return {
    decision: "allowed",
    requiresConfirmation,
    reasons: ["Within all limits"],
  };
}

export interface ApprovalInput {
  approverRole: Role;
  amountCents: number;
  policies: Policies;
}

export interface ApprovalDecision {
  permitted: boolean;
  reasons: string[];
}

/**
 * Rule 7 — an approver may only approve amounts within their own single-payment
 * (approval) limit. Employees cannot approve at all.
 */
export function evaluateApproval(input: ApprovalInput): ApprovalDecision {
  const { approverRole, amountCents, policies } = input;
  const approvalLimit = policies.roles[approverRole].approvalLimitCents;

  if (approvalLimit === null) {
    return {
      permitted: false,
      reasons: [`The ${approverRole} role may not approve payments`],
    };
  }
  if (amountCents > approvalLimit) {
    return {
      permitted: false,
      reasons: [
        `Above the ${formatEuros(approvalLimit)} approval limit for the ${approverRole} role`,
      ],
    };
  }
  return { permitted: true, reasons: [] };
}
