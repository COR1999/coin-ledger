import { describe, expect, it } from "vitest";

import { seedPolicies } from "@/lib/data/seed";
import { eur } from "@/lib/money";
import { applyPolicyForm, policiesToForm, policyFormSchema } from "./settings";

describe("policiesToForm / round-trip", () => {
  it("round-trips the seed policies unchanged", () => {
    const form = policyFormSchema.parse(policiesToForm(seedPolicies));
    const next = applyPolicyForm(seedPolicies, form);
    expect(next).toEqual(seedPolicies);
  });
});

describe("policyFormSchema", () => {
  it("rejects non-positive and malformed amounts", () => {
    const base = policiesToForm(seedPolicies);
    expect(
      policyFormSchema.safeParse({ ...base, minimumReserve: "0" }).success,
    ).toBe(false);
    expect(
      policyFormSchema.safeParse({ ...base, minimumReserve: "-5" }).success,
    ).toBe(false);
    expect(
      policyFormSchema.safeParse({ ...base, minimumReserve: "1.234" }).success,
    ).toBe(false);
    expect(
      policyFormSchema.safeParse({ ...base, minimumReserve: "abc" }).success,
    ).toBe(false);
  });

  it("enforces the role limit ordering (owner >= accountant >= employee)", () => {
    const base = policiesToForm(seedPolicies);
    expect(
      policyFormSchema.safeParse({
        ...base,
        accountantMaxSinglePayment: "5000", // above owner's 3000
      }).success,
    ).toBe(false);
    expect(
      policyFormSchema.safeParse({
        ...base,
        employeeMaxSinglePayment: "2500", // above accountant's 2000
      }).success,
    ).toBe(false);
  });
});

describe("applyPolicyForm", () => {
  it("updates numeric limits while preserving role flags and null caps", () => {
    const form = policyFormSchema.parse({
      ...policiesToForm(seedPolicies),
      minimumReserve: "4000",
      ownerMaxSinglePayment: "5000",
    });
    const next = applyPolicyForm(seedPolicies, form);

    expect(next.minimumReserveCents).toBe(eur(4_000));
    expect(next.roles.owner.maxSinglePaymentCents).toBe(eur(5_000));
    // Owner approval limit tracks their single-payment limit.
    expect(next.roles.owner.approvalLimitCents).toBe(eur(5_000));
    // Owner keeps their unlimited (null) daily limit — not exposed in the form.
    expect(next.roles.owner.dailyLimitCents).toBeNull();
    // Structural flags are untouched.
    expect(next.roles.employee.restrictedToApprovedSuppliers).toBe(true);
    expect(next.roles.owner.canEditPolicies).toBe(true);
    expect(next.roles.employee.approvalLimitCents).toBeNull();
  });
});
