/**
 * This app's policy engine. Genuinely delegates to the `agent-policy-gate`
 * package (packages/agent-policy-gate) — not a parallel copy. This file is
 * a thin adapter: it keeps the app's original call-site shape (Supplier,
 * no formatAmount param, same field names) stable for every existing
 * caller, and translates to and from the package's currency-agnostic,
 * app-agnostic shape underneath.
 *
 * See packages/agent-policy-gate/README.md for the actual decision rules
 * and the reasoning behind extracting this as a standalone primitive.
 */
import {
  evaluateApproval as gateEvaluateApproval,
  evaluatePolicy as gateEvaluatePolicy,
  type ApprovalDecision,
  type Payee,
  type Policies as GatePolicies,
  type PolicyBusinessState,
  type PolicyDecision,
  type RoleLimits as GateRoleLimits,
} from "agent-policy-gate";

import type { Actor, Policies, Role, Supplier } from "@/lib/domain/types";
import { formatEuros } from "@/lib/money";

export type { PolicyBusinessState, PolicyDecision, ApprovalDecision };

export interface PolicyInput {
  amountCents: number;
  actor: Actor;
  supplier: Supplier;
  businessState: PolicyBusinessState;
  policies: Policies;
}

function toGatePolicies(policies: Policies): GatePolicies {
  const roles = {} as Record<Role, GateRoleLimits>;
  for (const role of Object.keys(policies.roles) as Role[]) {
    const r = policies.roles[role];
    roles[role] = {
      maxSinglePaymentCents: r.maxSinglePaymentCents,
      dailyLimitCents: r.dailyLimitCents,
      approvalLimitCents: r.approvalLimitCents,
      restrictedToApprovedPayees: r.restrictedToApprovedSuppliers,
    };
  }
  return {
    roles,
    businessDailyLimitCents: policies.businessDailyLimitCents,
    minimumReserveCents: policies.minimumReserveCents,
    confirmationThresholdCents: policies.confirmationThresholdCents,
  };
}

function toGatePayee(supplier: Supplier): Payee {
  return {
    name: supplier.name,
    approved: supplier.employeeApproved,
    monthlyLimitCents: supplier.monthlyLimitCents,
    spentThisMonthCents: supplier.spentThisMonthCents,
    blocked: supplier.blocked,
  };
}

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  return gateEvaluatePolicy({
    amountCents: input.amountCents,
    actor: { name: input.actor.name, role: input.actor.role },
    payee: toGatePayee(input.supplier),
    businessState: input.businessState,
    policies: toGatePolicies(input.policies),
    formatAmount: formatEuros,
  });
}

export interface ApprovalInput {
  approverRole: Role;
  amountCents: number;
  policies: Policies;
}

export function evaluateApproval(input: ApprovalInput): ApprovalDecision {
  return gateEvaluateApproval({
    approverRole: input.approverRole,
    amountCents: input.amountCents,
    policies: toGatePolicies(input.policies),
    formatAmount: formatEuros,
  });
}
