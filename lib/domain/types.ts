/**
 * Core domain types shared by the finance and policy engines and the
 * repositories. Pure data — no React, Next.js, database or LLM dependencies.
 * All monetary fields are integer cents (see lib/money.ts).
 */
import { z } from "zod";

export type Role = "owner" | "accountant" | "employee";

export type Currency = "EUR";

export type Decision = "allowed" | "needs_approval" | "rejected";

export interface Actor {
  id: string;
  name: string;
  role: Role;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  /** May an employee pay this supplier without escalation? */
  employeeApproved: boolean;
  /** Cap on total spend to this supplier per calendar month, or null for none. */
  monthlyLimitCents: number | null;
  /** Spend to this supplier so far this calendar month. */
  spentThisMonthCents: number;
  /** On-chain receiving address. Required once PAYMENT_PROVIDER=arc. */
  walletAddress?: string;
}

export interface Obligation {
  id: string;
  name: string;
  category: string;
  amountCents: number;
  /** ISO date (YYYY-MM-DD) the obligation is due. */
  dueDate: string;
}

export interface Transaction {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  description: string;
  category: string;
  /** Positive for money in (revenue), negative for money out (expense). */
  amountCents: number;
  supplierId?: string;
}

export interface Business {
  id: string;
  name: string;
  currency: Currency;
  currentBalanceCents: number;
}

/** Per-role limits. `null` means "not applicable" for that role. */
export interface RoleLimits {
  /** Largest single payment this role may initiate. */
  maxSinglePaymentCents: number;
  /** Cap on this role's own payments per day, or null for no cap (owner). */
  dailyLimitCents: number | null;
  /** Largest amount this role may approve for others, or null if it cannot. */
  approvalLimitCents: number | null;
  /** Employees may only pay suppliers on the approved list. */
  restrictedToApprovedSuppliers: boolean;
  canEditPolicies: boolean;
}

export interface Policies {
  roles: Record<Role, RoleLimits>;
  /** Total spend allowed across all roles per day. */
  businessDailyLimitCents: number;
  /** Cash that must remain untouched (part of safe-to-spend). */
  minimumReserveCents: number;
  /** Payments strictly above this require explicit human confirmation. */
  confirmationThresholdCents: number;
}

/**
 * A proposed payment as produced by the agent's `proposePayment` tool and
 * consumed by the policy engine. Amount is a decimal string at this boundary.
 */
export const proposedPaymentSchema = z.object({
  supplierId: z.string().min(1),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "amount must be a decimal string"),
  currency: z.literal("EUR"),
  reason: z.string().min(1),
});

export type ProposedPayment = z.infer<typeof proposedPaymentSchema>;

export type ProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "awaiting_confirmation"
  | "confirmed"
  | "executing"
  | "executed"
  | "failed";

export interface PaymentProposal {
  id: string;
  supplierId: string;
  amountCents: number;
  currency: Currency;
  reason: string;
  proposedByActorId: string;
  status: ProposalStatus;
  createdAt: string;
  policyDecision: Decision;
  requiredApproverRole?: Extract<Role, "owner" | "accountant">;
  requiresConfirmation: boolean;
  approvedByActorId?: string;
  confirmedByActorId?: string;
  paymentId?: string;
  txHash?: string;
  failureReason?: string;
}
