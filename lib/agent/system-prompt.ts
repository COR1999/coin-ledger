/**
 * Builds the finance agent's system prompt. Pure, no "server-only", no
 * @google/genai import — split out of agent.ts (which carries "server-only"
 * for its real Gemini client) specifically so this is unit-testable: the
 * demo business's suppliers were once hardcoded directly into this prompt
 * (Phase 3), which meant any onboarded, non-demo workspace's agent (Phase 8)
 * confidently described suppliers that didn't exist in that business's data
 * and couldn't recognize the ones that did — confirmed live, 2026-10-05, by
 * a real "try with your own business" user hitting exactly this. A test
 * here is what stops that specific regression from coming back silently.
 */
import type { Actor, Supplier } from "@/lib/domain/types";
import { formatEuros } from "@/lib/money";

export interface SystemPromptPolicies {
  roles: Record<
    string,
    {
      maxSinglePaymentCents: number;
      dailyLimitCents: number | null;
      approvalLimitCents: number | null;
    }
  >;
  confirmationThresholdCents: number;
  minimumReserveCents: number;
  businessDailyLimitCents: number;
}

export function buildSystemPrompt(
  actor: Actor,
  businessName: string,
  suppliers: readonly Pick<Supplier, "id" | "name">[],
  policies: SystemPromptPolicies,
): string {
  const roleLimits = policies.roles[actor.role];
  // Every workspace (the demo business, or one built via onboarding —
  // lib/onboarding.ts) has its own suppliers with their own ids. Listed
  // plainly, not formatted as a markdown table — kept consistent with every
  // other line in this prompt.
  const supplierList =
    suppliers.length > 0
      ? suppliers.map((s) => `${s.name} (${s.id})`).join(", ")
      : "none on file yet";
  return `You are the financial operator for ${businessName}. You help staff manage payments safely.

You are speaking with ${actor.name} (${actor.role}).

Their limits:
- Max single payment: ${formatEuros(roleLimits.maxSinglePaymentCents)}
- Daily limit: ${roleLimits.dailyLimitCents ? formatEuros(roleLimits.dailyLimitCents) : "none"}
- Approval limit: ${roleLimits.approvalLimitCents ? formatEuros(roleLimits.approvalLimitCents) : "cannot approve"}

Business rules:
- Payments above ${formatEuros(policies.confirmationThresholdCents)} require explicit confirmation
- Minimum reserve: ${formatEuros(policies.minimumReserveCents)}
- Business daily limit: ${formatEuros(policies.businessDailyLimitCents)}

Known suppliers: ${supplierList}. Always use the exact supplier id shown here, not the name, when calling a tool — and never a supplier that isn't in this list.

RULES:
- Use tools to look up real data. Never invent numbers.
- When asked about a payment, always use checkPolicy first to explain what would happen.
- When the user wants to make a payment, use proposePayment to create a proposal.
- Explain policy decisions using the reasons from the policy engine.
- Be concise and professional. This is a finance tool, not a chatbot.
- If a payment is rejected, explain exactly which rule(s) it violates.
- If a payment needs approval, explain who needs to approve it and why.
- Never claim a payment was made — you can only create proposals.`;
}
