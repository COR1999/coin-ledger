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
  /**
   * Hard block: no role, including the owner, may pay this supplier while
   * true. Stronger than `employeeApproved`, which only restricts the
   * lowest-trust role. Modeled on the allowlist/blocklist primitive
   * Circle's own Compliance Engine documents for wallet risk management —
   * this is a local, always-on equivalent, not a call to that API.
   */
  blocked: boolean;
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
  /** ISO date (YYYY-MM-DD), for display — not precise enough to sort by. */
  date: string;
  /**
   * Full ISO datetime. Several transactions can share the same `date` (every
   * payment executed "today" lands on the same fixed demo-anchor date), so
   * this is the actual sort key for recency — `date` alone can't tell two
   * same-day transactions apart.
   */
  createdAt: string;
  description: string;
  category: string;
  /** Positive for money in (revenue), negative for money out (expense). */
  amountCents: number;
  supplierId?: string;
  /** Confirmed on-chain tx hash, for payments settled via Arc. */
  txHash?: string;
  /** The payment proposal that produced this transaction, if any. */
  proposalId?: string;
  /** The actor who proposed the payment, if any — drives per-actor daily limits. */
  proposedByActorId?: string;
  /**
   * A SHA-256 commitment over the exact policy decision that authorized
   * this payment (proposal id, amount, actor, supplier, decision, and the
   * live policy limits — see lib/payments/decision-receipt.ts), computed
   * the moment lib/payments/execute.ts's server-side re-check passed, right
   * before execution. A local, tamper-evident record — not a blockchain
   * attestation — that the decision an auditor sees today is the same one
   * that was actually made, not edited after the fact. Optional: only set
   * on transactions recorded after this feature shipped (2026-10-06).
   */
  decisionHash?: string;
}

export interface Business {
  id: string;
  name: string;
  currency: Currency;
  currentBalanceCents: number;
}

/**
 * A landing-page waitlist signup (Phase 9). Site-wide, not per-workspace —
 * a visitor expresses interest independent of which business they viewed.
 */
export interface WaitlistSignup {
  id: string;
  name: string;
  email: string;
  businessType: string;
  note?: string;
  createdAt: string;
}

export const waitlistSignupInputSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  businessType: z.string().trim().min(1, "Required").max(60),
  note: z.string().trim().max(500).optional(),
});

export type WaitlistSignupInput = z.infer<typeof waitlistSignupInputSchema>;

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
  /**
   * Owner-only emergency circuit breaker: when true, no payment may execute
   * and the agent won't create new proposals, regardless of any other
   * policy check passing. Modeled on a feature comparable Arc/Tameion
   * hackathon AP agents document as standard (vendor allowlist, per-tx/daily
   * limits, cash floor, pause control, duplicate-payment protection) — this
   * app already had every one of those except pause control. Re-checked at
   * the same server-side execution path as every other policy rule
   * (lib/payments/execute.ts), never trusted from an earlier decision.
   */
  paymentsPaused: boolean;
  /**
   * Owner-only opt-in: publishes a read-only, no-login "proof of
   * operations" page (app/t/[workspaceId]) listing this business's
   * executed payments with their real on-chain tx hashes and decision
   * commitments — the "provable, not just logged" pitch, made checkable
   * by anyone, not just asserted. Off by default for onboarded workspaces
   * (a real business's transaction history is sensitive by default); on
   * for the demo, to showcase it. Deliberately excludes balance, policy
   * limits, and anything not already settled on-chain — publishing exact
   * spending limits or cash position would be a real competitive-
   * intelligence leak for a real business, so this only ever surfaces
   * facts that are already independently verifiable on the explorer.
   */
  publicTransparencyEnabled: boolean;
  /**
   * Owner-only opt-in: a webhook URL (Slack/Discord incoming webhook, or any
   * generic JSON listener — Zapier, Make, a custom endpoint) notified the
   * moment a proposal lands in a state that needs a human to act (pending
   * approval or awaiting confirmation) — not on every proposal, since an
   * auto-approved payment inside every limit needs nobody's attention.
   * Real owners don't want to remember to poll /approvals; a real approval
   * workflow pings the people who have to act. See lib/notify/webhook.ts.
   */
  notificationWebhookUrl?: string;
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
  /**
   * Execution attempts made so far (0 before the first submission). Folded
   * into the idempotency key seed so a retry of a failed payment gets a
   * genuinely new key — reusing the original key would make Circle replay
   * the same failed result forever, since idempotency keys are meant to
   * dedupe repeats of one logical attempt, not distinguish retries.
   */
  attempts: number;
}
