import { describe, expect, it } from "vitest";

import { seedActors, seedPolicies, seedSuppliers } from "@/lib/data/seed";
import type { Actor, Role, Supplier } from "@/lib/domain/types";
import { eur } from "@/lib/money";
import {
  evaluateApproval,
  evaluatePolicy,
  type PolicyBusinessState,
} from "./engine";

const policies = seedPolicies;

function actor(role: Role): Actor {
  const found = seedActors.find((a) => a.role === role);
  if (!found) throw new Error(`no seed actor for role ${role}`);
  return found;
}

function supplier(id: string, overrides: Partial<Supplier> = {}): Supplier {
  const found = seedSuppliers.find((s) => s.id === id);
  if (!found) throw new Error(`no seed supplier ${id}`);
  return { ...found, ...overrides };
}

/** Default healthy business state: safe-to-spend = 18,420 − 9,730 − 3,000 = €5,690. */
function state(
  overrides: Partial<PolicyBusinessState> = {},
): PolicyBusinessState {
  return {
    balanceCents: eur(18_420),
    obligationsNext30DaysCents: eur(9_730),
    todaySpentByActorCents: eur(0),
    todaySpentByBusinessCents: eur(0),
    ...overrides,
  };
}

describe("evaluatePolicy — decision scenarios", () => {
  it("1. Mario pays ABC Coffee €500 → allowed, no confirmation", () => {
    const result = evaluatePolicy({
      amountCents: eur(500),
      actor: actor("owner"),
      supplier: supplier("abc-coffee"),
      businessState: state(),
      policies,
    });
    expect(result.decision).toBe("allowed");
    expect(result.requiresConfirmation).toBe(false);
  });

  it("2. Mario pays ABC Coffee €2,400 → allowed, requiresConfirmation", () => {
    const result = evaluatePolicy({
      amountCents: eur(2_400),
      actor: actor("owner"),
      supplier: supplier("abc-coffee"),
      businessState: state(),
      policies,
    });
    expect(result.decision).toBe("allowed");
    expect(result.requiresConfirmation).toBe(true);
  });

  it("3. Liam pays ABC Coffee €2,400 → needs_approval, approver owner", () => {
    const result = evaluatePolicy({
      amountCents: eur(2_400),
      actor: actor("employee"),
      supplier: supplier("abc-coffee"),
      businessState: state(),
      policies,
    });
    expect(result.decision).toBe("needs_approval");
    expect(result.requiredApproverRole).toBe("owner");
  });

  it("4. Mario pays ABC Coffee €4,000 → rejected (over owner max)", () => {
    const result = evaluatePolicy({
      amountCents: eur(4_000),
      actor: actor("owner"),
      supplier: supplier("abc-coffee"),
      businessState: state(),
      policies,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/maximum single payment/i);
  });

  it("5. Mario pays €2,500 when safe-to-spend is €2,000 → rejected (breaches reserve)", () => {
    // balance 5,000 − obligations 0 − reserve 3,000 = safe-to-spend €2,000.
    const result = evaluatePolicy({
      amountCents: eur(2_500),
      actor: actor("owner"),
      supplier: supplier("abc-coffee"),
      businessState: state({
        balanceCents: eur(5_000),
        obligationsNext30DaysCents: eur(0),
      }),
      policies,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/safe-to-spend|reserve/i);
  });

  it("6. Liam pays Local Veg €30 → allowed, no confirmation", () => {
    const result = evaluatePolicy({
      amountCents: eur(30),
      actor: actor("employee"),
      supplier: supplier("local-veg"),
      businessState: state(),
      policies,
    });
    expect(result.decision).toBe("allowed");
    expect(result.requiresConfirmation).toBe(false);
  });

  it("7. Liam pays Unknown Vendor Ltd €50 → rejected (not approved supplier)", () => {
    const result = evaluatePolicy({
      amountCents: eur(50),
      actor: actor("employee"),
      supplier: supplier("unknown-vendor"),
      businessState: state(),
      policies,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/approved supplier list/i);
  });

  it("8. Liam pays Local Veg €150 → needs_approval, approver accountant", () => {
    const result = evaluatePolicy({
      amountCents: eur(150),
      actor: actor("employee"),
      supplier: supplier("local-veg"),
      businessState: state(),
      policies,
    });
    expect(result.decision).toBe("needs_approval");
    expect(result.requiredApproverRole).toBe("accountant");
  });

  it("9. Liam has paid €280 today, pays Local Veg €30 → rejected (employee daily limit)", () => {
    const result = evaluatePolicy({
      amountCents: eur(30),
      actor: actor("employee"),
      supplier: supplier("local-veg"),
      businessState: state({
        todaySpentByActorCents: eur(280),
        todaySpentByBusinessCents: eur(280),
      }),
      policies,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/daily limit/i);
  });

  it("10. ABC Coffee at €6,000 this month, Mario pays €2,400 → rejected (supplier monthly limit)", () => {
    const result = evaluatePolicy({
      amountCents: eur(2_400),
      actor: actor("owner"),
      supplier: supplier("abc-coffee", { spentThisMonthCents: eur(6_000) }),
      businessState: state(),
      policies,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/monthly limit/i);
  });

  it("11. Aoife pays ABC Coffee €2,400 → needs_approval, approver owner", () => {
    const result = evaluatePolicy({
      amountCents: eur(2_400),
      actor: actor("accountant"),
      supplier: supplier("abc-coffee"),
      businessState: state(),
      policies,
    });
    expect(result.decision).toBe("needs_approval");
    expect(result.requiredApproverRole).toBe("owner");
  });

  it("12. Business has paid €9,000 today, Mario pays €1,500 → rejected (business daily limit)", () => {
    const result = evaluatePolicy({
      amountCents: eur(1_500),
      actor: actor("owner"),
      supplier: supplier("abc-coffee"),
      businessState: state({ todaySpentByBusinessCents: eur(9_000) }),
      policies,
    });
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/business daily limit/i);
  });
});

describe("evaluateApproval", () => {
  it("13. Aoife cannot approve Liam's €2,400 request (above her approval limit)", () => {
    const result = evaluateApproval({
      approverRole: "accountant",
      amountCents: eur(2_400),
      policies,
    });
    expect(result.permitted).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/approval limit/i);
  });

  it("permits an accountant to approve within their €2,000 limit", () => {
    const result = evaluateApproval({
      approverRole: "accountant",
      amountCents: eur(1_800),
      policies,
    });
    expect(result.permitted).toBe(true);
  });

  it("never permits an employee to approve", () => {
    const result = evaluateApproval({
      approverRole: "employee",
      amountCents: eur(10),
      policies,
    });
    expect(result.permitted).toBe(false);
  });
});
