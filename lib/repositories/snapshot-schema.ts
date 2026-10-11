/**
 * Runtime validation for data read back from Redis. TypeScript types vanish
 * at runtime, and a blob in Redis can be truncated, hand-edited, or written
 * by an older build. Without a check, a malformed snapshot flows straight
 * into the policy engine and execution path (e.g. a missing balance becomes
 * NaN and every comparison against it silently passes).
 *
 * Each schema is annotated with its domain type, so a field added to
 * lib/domain/types.ts without updating this file fails typecheck.
 *
 * Backward compatibility: `blocked`, `paymentsPaused` and
 * `publicTransparencyEnabled` were added after Redis storage went live
 * (2026-10-06), so snapshots written before then lack them. They default to
 * false, which is exactly how the code already treated the missing value.
 */
import { z } from "zod";

import type {
  Actor,
  Business,
  Obligation,
  PaymentProposal,
  Policies,
  RoleLimits,
  Supplier,
  Transaction,
  WaitlistSignup,
} from "@/lib/domain/types";
import type { WorkspaceSnapshot } from "./kv-snapshot";

type Schema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

const cents = z.number().int();
const role = z.enum(["owner", "accountant", "employee"]);
const isoDate = z.string().min(1);

const businessSchema: Schema<Business> = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.literal("EUR"),
  currentBalanceCents: cents,
});

const actorSchema: Schema<Actor> = z.object({
  id: z.string(),
  name: z.string(),
  role,
});

const supplierSchema: Schema<Supplier> = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  employeeApproved: z.boolean(),
  monthlyLimitCents: cents.nullable(),
  spentThisMonthCents: cents,
  walletAddress: z.string().optional(),
  blocked: z.boolean().default(false),
});

const obligationSchema: Schema<Obligation> = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  amountCents: cents,
  dueDate: isoDate,
});

const transactionSchema: Schema<Transaction> = z.object({
  id: z.string(),
  date: isoDate,
  createdAt: isoDate,
  description: z.string(),
  category: z.string(),
  amountCents: cents,
  supplierId: z.string().optional(),
  txHash: z.string().optional(),
  proposalId: z.string().optional(),
  proposedByActorId: z.string().optional(),
  decisionHash: z.string().optional(),
});

const roleLimitsSchema: Schema<RoleLimits> = z.object({
  maxSinglePaymentCents: cents,
  dailyLimitCents: cents.nullable(),
  approvalLimitCents: cents.nullable(),
  restrictedToApprovedSuppliers: z.boolean(),
  canEditPolicies: z.boolean(),
});

const policiesSchema: Schema<Policies> = z.object({
  roles: z.object({
    owner: roleLimitsSchema,
    accountant: roleLimitsSchema,
    employee: roleLimitsSchema,
  }),
  businessDailyLimitCents: cents,
  minimumReserveCents: cents,
  confirmationThresholdCents: cents,
  paymentsPaused: z.boolean().default(false),
  publicTransparencyEnabled: z.boolean().default(false),
  notificationWebhookUrl: z.string().optional(),
});

const proposalSchema: Schema<PaymentProposal> = z.object({
  id: z.string(),
  supplierId: z.string(),
  amountCents: cents,
  currency: z.literal("EUR"),
  reason: z.string(),
  proposedByActorId: z.string(),
  status: z.enum([
    "pending",
    "approved",
    "rejected",
    "awaiting_confirmation",
    "confirmed",
    "executing",
    "executed",
    "failed",
  ]),
  createdAt: isoDate,
  policyDecision: z.enum(["allowed", "needs_approval", "rejected"]),
  requiredApproverRole: z.enum(["owner", "accountant"]).optional(),
  requiresConfirmation: z.boolean(),
  approvedByActorId: z.string().optional(),
  confirmedByActorId: z.string().optional(),
  paymentId: z.string().optional(),
  txHash: z.string().optional(),
  failureReason: z.string().optional(),
  attempts: z.number().int().nonnegative(),
});

export const workspaceSnapshotSchema: Schema<WorkspaceSnapshot> = z.object({
  business: businessSchema,
  actors: z.array(actorSchema),
  suppliers: z.array(supplierSchema),
  transactions: z.array(transactionSchema),
  policies: policiesSchema,
  obligations: z.array(obligationSchema),
  proposals: z.array(proposalSchema).default([]),
  resetAt: z.string().optional(),
});

export const waitlistSchema: Schema<WaitlistSignup[]> = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    businessType: z.string(),
    note: z.string().optional(),
    createdAt: isoDate,
  }),
);

export class CorruptStoredDataError extends Error {
  constructor(key: string, issues: z.ZodIssue[]) {
    const summary = issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    super(`Stored data at "${key}" failed validation: ${summary}`);
    this.name = "CorruptStoredDataError";
  }
}

/** Parses `raw` or throws CorruptStoredDataError naming the key and fields.
 * Fails loudly on purpose: operating on half-valid financial state is worse
 * than an error page. */
export function parseStored<T>(
  schema: Schema<T>,
  key: string,
  raw: unknown,
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new CorruptStoredDataError(key, result.error.issues);
  }
  return result.data;
}
