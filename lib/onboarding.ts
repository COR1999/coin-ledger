/**
 * Bring-your-own workspace onboarding (Phase 8). Builds an isolated
 * workspace from a short wizard's input — a real visitor's own business, not
 * Mario's Coffee — and registers it in the repositories singleton under a
 * fresh workspace id.
 *
 * Deliberately minimal: policy limits aren't collected here. Every new
 * workspace starts on the same default limits as the demo business
 * (`seedPolicies`), editable afterwards via the existing /settings page,
 * which already enforces owner-only editing. Rebuilding policy editing
 * inside onboarding would duplicate that page for no real benefit at
 * hackathon scale. Obligations (bills) also aren't collected — a fresh
 * workspace starts with none, which is honest (unlike inheriting Mario's
 * Coffee's), not a placeholder for a feature that's actually missing.
 *
 * No "server-only" guard here (unlike lib/repositories/singleton.ts): this
 * is pure data construction, same category as lib/payments/execute.ts or
 * lib/repositories/in-memory.ts, neither of which carries one either. It's
 * only ever invoked from app/actions/onboarding.ts ("use server"), which is
 * the actual server boundary.
 */
import { z } from "zod";

import { seedPolicies } from "@/lib/data/seed";
import type { Actor, Business, Supplier } from "@/lib/domain/types";
import { registerWorkspace } from "@/lib/repositories/workspace-store";

/** A sensible starting cash position for trying the product — not a real balance. */
const STARTING_BALANCE_CENTS = 5_00000; // €5,000.00

/**
 * Placeholder receiving address for onboarding suppliers. Every onboarding
 * workspace is forced onto the mock provider (lib/payments/provider.ts), so
 * this is never submitted to a real chain — it exists only because
 * lib/payments/execute.ts requires *some* walletAddress before it will
 * execute a payment. Without one, a visitor's first payment attempt would
 * fail with MISSING_WALLET_ADDRESS, breaking the entire reason onboarding
 * exists: letting them see the full propose → approve → execute flow.
 */
const PLACEHOLDER_WALLET_ADDRESS = "0x0000000000000000000000000000000000demo";

export const onboardingSupplierSchema = z.object({
  name: z.string().trim().min(1, "Required").max(60),
  category: z.string().trim().min(1, "Required").max(40),
});

export const onboardingInputSchema = z.object({
  businessName: z.string().trim().min(1, "Required").max(80),
  ownerName: z.string().trim().min(1, "Required").max(60),
  suppliers: z.array(onboardingSupplierSchema).min(1).max(3),
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

/** Builds a visitor's workspace and registers it. Returns the new workspace id. */
export async function createWorkspace(input: OnboardingInput): Promise<string> {
  const workspaceId = `ws-${crypto.randomUUID()}`;

  const business: Business = {
    id: workspaceId,
    name: input.businessName,
    currency: "EUR",
    currentBalanceCents: STARTING_BALANCE_CENTS,
  };

  const actors: Actor[] = [
    { id: "owner", name: input.ownerName, role: "owner" },
    { id: "accountant", name: "Accountant", role: "accountant" },
    { id: "employee", name: "Employee", role: "employee" },
  ];

  const suppliers: Supplier[] = input.suppliers.map((s, i) => ({
    id: `supplier-${i + 1}`,
    name: s.name,
    category: s.category,
    employeeApproved: true,
    monthlyLimitCents: null,
    spentThisMonthCents: 0,
    walletAddress: PLACEHOLDER_WALLET_ADDRESS,
  }));

  await registerWorkspace(workspaceId, {
    business,
    actors,
    suppliers,
    transactions: [],
    policies: seedPolicies,
    obligations: [],
  });

  return workspaceId;
}
