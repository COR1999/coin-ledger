import type { PaymentProposal, Policies, Role } from "@/lib/domain/types";
import { evaluateApproval } from "@/lib/policy/engine";

/**
 * Statuses a human may still reject or cancel. Deliberately excludes
 * "approved", "confirmed" and "executing": in those states the payment is
 * either being submitted right now or already reached the provider, so a
 * rejection could mark a payment "rejected" that actually settled on-chain,
 * leaving it permanently missing from the ledger. Those are resolved through
 * Retry instead. "executed" and "rejected" are final.
 */
export const REJECTABLE_STATUSES: readonly PaymentProposal["status"][] = [
  "pending",
  "awaiting_confirmation",
  "failed",
];

export interface RejectionInput {
  actorRole: Role;
  proposal: Pick<PaymentProposal, "status" | "amountCents">;
  policies: Policies;
}

export interface RejectionDecision {
  permitted: boolean;
  reasons: string[];
}

/**
 * Whether `actorRole` may reject this proposal. Uses the same authority bound
 * as approving, confirming and retrying: only a role whose approval limit
 * covers the amount may decide this payment's outcome, in either direction.
 */
export function evaluateRejection(input: RejectionInput): RejectionDecision {
  const { actorRole, proposal, policies } = input;
  if (!REJECTABLE_STATUSES.includes(proposal.status)) {
    return {
      permitted: false,
      reasons: [`Cannot reject a proposal with status "${proposal.status}"`],
    };
  }
  return evaluateApproval({
    approverRole: actorRole,
    amountCents: proposal.amountCents,
    policies,
  });
}
