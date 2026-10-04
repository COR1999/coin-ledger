import { describe, expect, it } from "vitest";

import {
  evaluateApproval,
  evaluatePolicy,
  type PolicyBusinessState,
} from "./engine";
import type { Actor, Payee, Policies, Role } from "./types";

/** Whole-unit amount -> integer minor units (cents), matching lib/money.ts's
 * eur() in the host app — this package has no opinion on currency, but
 * tests still need a convenient way to write whole amounts. */
const cents = (n: number) => n * 100;

const formatAmount = (c: number) => `$${(c / 100).toFixed(2)}`;

const policies: Policies = {
  roles: {
    owner: {
      maxSinglePaymentCents: cents(3_000),
      dailyLimitCents: null,
      approvalLimitCents: cents(3_000),
      restrictedToApprovedPayees: false,
    },
    accountant: {
      maxSinglePaymentCents: cents(2_000),
      dailyLimitCents: cents(5_000),
      approvalLimitCents: cents(2_000),
      restrictedToApprovedPayees: false,
    },
    employee: {
      maxSinglePaymentCents: cents(100),
      dailyLimitCents: cents(300),
      approvalLimitCents: null,
      restrictedToApprovedPayees: true,
    },
  },
  businessDailyLimitCents: cents(10_000),
  minimumReserveCents: cents(3_000),
  confirmationThresholdCents: cents(1_000),
};

const actors: Record<Role, Actor> = {
  owner: { name: "Mario", role: "owner" },
  accountant: { name: "Aoife", role: "accountant" },
  employee: { name: "Liam", role: "employee" },
};

const payees: Record<string, Payee> = {
  coffee: {
    name: "ABC Coffee",
    approved: true,
    monthlyLimitCents: cents(8_000),
    spentThisMonthCents: cents(4_600),
  },
  veg: {
    name: "Local Veg",
    approved: true,
    monthlyLimitCents: cents(1_500),
    spentThisMonthCents: cents(300),
  },
  unknown: {
    name: "Unknown Vendor",
    approved: false,
    monthlyLimitCents: null,
    spentThisMonthCents: 0,
  },
};

function payee(id: keyof typeof payees, overrides: Partial<Payee> = {}): Payee {
  return { ...payees[id], ...overrides };
}

/** Default healthy business state: safe-to-spend = 18,420 − 9,730 − 3,000 = $5,690. */
function state(
  overrides: Partial<PolicyBusinessState> = {},
): PolicyBusinessState {
  return {
    balanceCents: cents(18_420),
    obligationsNext30DaysCents: cents(9_730),
    todaySpentByActorCents: 0,
    todaySpentByBusinessCents: 0,
    committedPendingCents: 0,
    ...overrides,
  };
}

describe("evaluatePolicy — decision scenarios", () => {
  it("owner pays an approved payee $500 → allowed, no confirmation", () => {
    const result = evaluatePolicy({
      amountCents: cents(500),
      actor: actors.owner,
      payee: payee("coffee"),
      businessState: state(),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("allowed");
    expect(result.requiresConfirmation).toBe(false);
  });

  it("owner pays $2,400 (above confirmation threshold) → allowed, requiresConfirmation", () => {
    const result = evaluatePolicy({
      amountCents: cents(2_400),
      actor: actors.owner,
      payee: payee("coffee"),
      businessState: state(),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("allowed");
    expect(result.requiresConfirmation).toBe(true);
  });

  it("employee pays $2,400 → needs_approval, approver owner", () => {
    const result = evaluatePolicy({
      amountCents: cents(2_400),
      actor: actors.employee,
      payee: payee("coffee"),
      businessState: state(),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("needs_approval");
    expect(result.requiredApproverRole).toBe("owner");
  });

  it("owner pays $4,000 → rejected (over owner max)", () => {
    const result = evaluatePolicy({
      amountCents: cents(4_000),
      actor: actors.owner,
      payee: payee("coffee"),
      businessState: state(),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/maximum single payment/i);
  });

  it("owner pays $2,500 when safe-to-spend is $2,000 → rejected (breaches reserve)", () => {
    const result = evaluatePolicy({
      amountCents: cents(2_500),
      actor: actors.owner,
      payee: payee("coffee"),
      businessState: state({
        balanceCents: cents(5_000),
        obligationsNext30DaysCents: 0,
      }),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/safe-to-spend|reserve/i);
  });

  it("owner pays $500 but $5,600 is already committed to other pending proposals → rejected (breaches reserve)", () => {
    // Baseline safe-to-spend is $5,690; $5,600 already committed elsewhere
    // leaves only $90 free, even though nothing has left the balance yet.
    const result = evaluatePolicy({
      amountCents: cents(500),
      actor: actors.owner,
      payee: payee("coffee"),
      businessState: state({ committedPendingCents: cents(5_600) }),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/safe-to-spend|reserve/i);
  });

  it("still allows a payment that fits within what other pending proposals leave free", () => {
    const result = evaluatePolicy({
      amountCents: cents(50),
      actor: actors.owner,
      payee: payee("coffee"),
      businessState: state({ committedPendingCents: cents(5_600) }),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("allowed");
  });

  it("employee pays an approved payee $30 → allowed, no confirmation", () => {
    const result = evaluatePolicy({
      amountCents: cents(30),
      actor: actors.employee,
      payee: payee("veg"),
      businessState: state(),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("allowed");
    expect(result.requiresConfirmation).toBe(false);
  });

  it("employee pays an unapproved payee → rejected (not approved)", () => {
    const result = evaluatePolicy({
      amountCents: cents(50),
      actor: actors.employee,
      payee: payee("unknown"),
      businessState: state(),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/approved payee list/i);
  });

  it("employee pays $150 → needs_approval, approver accountant", () => {
    const result = evaluatePolicy({
      amountCents: cents(150),
      actor: actors.employee,
      payee: payee("veg"),
      businessState: state(),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("needs_approval");
    expect(result.requiredApproverRole).toBe("accountant");
  });

  it("employee has spent $280 today, pays $30 → rejected (actor daily limit)", () => {
    const result = evaluatePolicy({
      amountCents: cents(30),
      actor: actors.employee,
      payee: payee("veg"),
      businessState: state({
        todaySpentByActorCents: cents(280),
        todaySpentByBusinessCents: cents(280),
      }),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/daily limit/i);
  });

  it("payee at $6,000 this month, owner pays $2,400 → rejected (payee monthly limit)", () => {
    const result = evaluatePolicy({
      amountCents: cents(2_400),
      actor: actors.owner,
      payee: payee("coffee", { spentThisMonthCents: cents(6_000) }),
      businessState: state(),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/monthly limit/i);
  });

  it("accountant pays $2,400 → needs_approval, approver owner", () => {
    const result = evaluatePolicy({
      amountCents: cents(2_400),
      actor: actors.accountant,
      payee: payee("coffee"),
      businessState: state(),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("needs_approval");
    expect(result.requiredApproverRole).toBe("owner");
  });

  it("business has spent $9,000 today, owner pays $1,500 → rejected (business daily limit)", () => {
    const result = evaluatePolicy({
      amountCents: cents(1_500),
      actor: actors.owner,
      payee: payee("coffee"),
      businessState: state({ todaySpentByBusinessCents: cents(9_000) }),
      policies,
      formatAmount,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/business daily limit/i);
  });
});

describe("evaluateApproval", () => {
  it("accountant cannot approve above their approval limit", () => {
    const result = evaluateApproval({
      approverRole: "accountant",
      amountCents: cents(2_400),
      policies,
      formatAmount,
    });
    expect(result.permitted).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/approval limit/i);
  });

  it("permits an accountant to approve within their limit", () => {
    const result = evaluateApproval({
      approverRole: "accountant",
      amountCents: cents(1_800),
      policies,
      formatAmount,
    });
    expect(result.permitted).toBe(true);
  });

  it("never permits an employee to approve", () => {
    const result = evaluateApproval({
      approverRole: "employee",
      amountCents: cents(10),
      policies,
      formatAmount,
    });
    expect(result.permitted).toBe(false);
  });
});
