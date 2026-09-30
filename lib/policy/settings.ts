/**
 * Policy settings editing. Pure, testable logic for the owner-only settings
 * form: a zod schema over the euro-decimal strings the form submits, and a
 * function that folds those values onto the current policies while preserving
 * every non-editable field (role flags, approval permissions, null caps). No
 * React, Next.js, database or LLM dependencies.
 *
 * Only numeric limits are editable. Role capabilities (who may approve, who is
 * restricted to approved suppliers, who may edit policies) are structural and
 * deliberately not exposed, so an owner cannot lock themselves out.
 */
import { z } from "zod";

import type { Policies } from "@/lib/domain/types";
import { formatCents, parseAmountToCents } from "@/lib/money";

const EURO_DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

/** A positive euro-decimal string (e.g. "3000", "2000.50"). */
const positiveEuroString = z
  .string()
  .trim()
  .regex(EURO_DECIMAL_RE, "Enter an amount like 3000 or 2000.50")
  // Guarded so it never runs parseAmountToCents on input the regex rejected
  // (zod still evaluates refinements after an earlier check fails).
  .refine(
    (v) => EURO_DECIMAL_RE.test(v.trim()) && parseAmountToCents(v) > 0,
    "Must be greater than zero",
  );

export const policyFormSchema = z
  .object({
    minimumReserve: positiveEuroString,
    businessDailyLimit: positiveEuroString,
    confirmationThreshold: positiveEuroString,
    ownerMaxSinglePayment: positiveEuroString,
    accountantMaxSinglePayment: positiveEuroString,
    accountantDailyLimit: positiveEuroString,
    employeeMaxSinglePayment: positiveEuroString,
    employeeDailyLimit: positiveEuroString,
  })
  .refine(
    (v) =>
      safeCents(v.accountantMaxSinglePayment) <=
      safeCents(v.ownerMaxSinglePayment),
    {
      message:
        "Accountant single-payment limit cannot exceed the owner's limit",
      path: ["accountantMaxSinglePayment"],
    },
  )
  .refine(
    (v) =>
      safeCents(v.employeeMaxSinglePayment) <=
      safeCents(v.accountantMaxSinglePayment),
    {
      message:
        "Employee single-payment limit cannot exceed the accountant's limit",
      path: ["employeeMaxSinglePayment"],
    },
  );

/** Parse to cents, or -1 if malformed — lets cross-field refines skip throwing. */
function safeCents(v: string): number {
  return EURO_DECIMAL_RE.test(v.trim()) ? parseAmountToCents(v) : -1;
}

export type PolicyForm = z.infer<typeof policyFormSchema>;

/** Populate the form's fields from the current policies (cents -> euro strings). */
export function policiesToForm(policies: Policies): PolicyForm {
  return {
    minimumReserve: formatCents(policies.minimumReserveCents),
    businessDailyLimit: formatCents(policies.businessDailyLimitCents),
    confirmationThreshold: formatCents(policies.confirmationThresholdCents),
    ownerMaxSinglePayment: formatCents(
      policies.roles.owner.maxSinglePaymentCents,
    ),
    accountantMaxSinglePayment: formatCents(
      policies.roles.accountant.maxSinglePaymentCents,
    ),
    accountantDailyLimit: formatCents(
      policies.roles.accountant.dailyLimitCents ?? 0,
    ),
    employeeMaxSinglePayment: formatCents(
      policies.roles.employee.maxSinglePaymentCents,
    ),
    employeeDailyLimit: formatCents(
      policies.roles.employee.dailyLimitCents ?? 0,
    ),
  };
}

/**
 * Fold validated form values onto the current policies. The owner's approval
 * limit tracks their single-payment limit (an owner can approve anything they
 * could initiate); all role flags and the owner's null daily limit are kept.
 */
export function applyPolicyForm(current: Policies, form: PolicyForm): Policies {
  const ownerMax = parseAmountToCents(form.ownerMaxSinglePayment);
  const accountantMax = parseAmountToCents(form.accountantMaxSinglePayment);
  const employeeMax = parseAmountToCents(form.employeeMaxSinglePayment);

  return {
    ...current,
    minimumReserveCents: parseAmountToCents(form.minimumReserve),
    businessDailyLimitCents: parseAmountToCents(form.businessDailyLimit),
    confirmationThresholdCents: parseAmountToCents(form.confirmationThreshold),
    roles: {
      owner: {
        ...current.roles.owner,
        maxSinglePaymentCents: ownerMax,
        approvalLimitCents: ownerMax,
      },
      accountant: {
        ...current.roles.accountant,
        maxSinglePaymentCents: accountantMax,
        approvalLimitCents: accountantMax,
        dailyLimitCents: parseAmountToCents(form.accountantDailyLimit),
      },
      employee: {
        ...current.roles.employee,
        maxSinglePaymentCents: employeeMax,
        dailyLimitCents: parseAmountToCents(form.employeeDailyLimit),
      },
    },
  };
}
