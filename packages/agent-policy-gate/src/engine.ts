/**
 * Agent policy gate. Pure, deterministic TypeScript: no framework, database,
 * LLM, or blockchain dependency. Given a proposed payment, the actor
 * proposing it, the current business state and your policies, it decides
 * whether the payment is allowed, needs approval, or is rejected — and
 * explains why in plain, auditable reasons.
 *
 * This is the layer that makes it safe to let an LLM agent propose
 * payments at all: the agent calls a `proposePayment`-style tool, this
 * function decides, and nothing executes without passing through it. The
 * agent's own output is never trusted as authorization — see the host
 * app's execution path (lib/payments/execute.ts) for how this gets
 * re-run server-side immediately before a payment settles, never just
 * once at proposal time.
 *
 * Decision rules, evaluated so that every applicable reason is reported:
 *   1. Any business-wide rule broken               -> rejected
 *   2. Amount above the owner's single-payment max  -> rejected
 *   3. Lowest-trust role paying a non-approved payee -> rejected
 *   4. Role exceeding its own daily limit            -> rejected
 *   5. Actor's single-payment limit exceeded (but <= owner max) -> needs_approval
 *   6. Otherwise                                     -> allowed
 *   7. (evaluateApproval) An approver may only approve within their own limit
 *   8. requiresConfirmation = amount > confirmation threshold
 */
import type { Actor, Decision, Payee, Policies, Role } from "./types";

/** Formats a cents amount for a human-readable reason string. Required, not
 * defaulted — this package has no opinion on your currency or locale. */
export type AmountFormatter = (cents: number) => string;

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
  payee: Payee;
  businessState: PolicyBusinessState;
  policies: Policies;
  formatAmount: AmountFormatter;
}

export interface PolicyDecision {
  decision: Decision;
  requiredApproverRole?: Extract<Role, "owner" | "accountant">;
  requiresConfirmation: boolean;
  reasons: string[];
}

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const { amountCents, actor, payee, businessState, policies, formatAmount } =
    input;
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
      `Exceeds safe-to-spend of ${formatAmount(safeToSpend)} (would breach the ${formatAmount(
        policies.minimumReserveCents,
      )} minimum reserve)`,
    );
  }

  if (
    businessState.todaySpentByBusinessCents + amountCents >
    policies.businessDailyLimitCents
  ) {
    rejections.push(
      `Exceeds the business daily limit of ${formatAmount(policies.businessDailyLimitCents)}`,
    );
  }

  if (
    payee.monthlyLimitCents !== null &&
    payee.spentThisMonthCents + amountCents > payee.monthlyLimitCents
  ) {
    rejections.push(
      `Exceeds ${payee.name}'s monthly limit of ${formatAmount(payee.monthlyLimitCents)}`,
    );
  }

  // Rule 2 — above the owner's single-payment maximum (the hard ceiling).
  if (amountCents > ownerMax) {
    rejections.push(
      `Exceeds the maximum single payment of ${formatAmount(ownerMax)}`,
    );
  }

  // Rule 3 — lowest-trust role paying a payee that is not on the approved list.
  if (roleLimits.restrictedToApprovedPayees && !payee.approved) {
    rejections.push(
      `${payee.name} is not on the approved payee list for ${actor.name}`,
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
      `Exceeds ${actor.name}'s daily limit of ${formatAmount(roleLimits.dailyLimitCents)}`,
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
        `Exceeds ${actor.name}'s ${formatAmount(
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
  formatAmount: AmountFormatter;
}

export interface ApprovalDecision {
  permitted: boolean;
  reasons: string[];
}

/**
 * Rule 7 — an approver may only approve amounts within their own single-payment
 * (approval) limit. The lowest-trust role cannot approve at all.
 */
export function evaluateApproval(input: ApprovalInput): ApprovalDecision {
  const { approverRole, amountCents, policies, formatAmount } = input;
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
        `Above the ${formatAmount(approvalLimit)} approval limit for the ${approverRole} role`,
      ],
    };
  }
  return { permitted: true, reasons: [] };
}
