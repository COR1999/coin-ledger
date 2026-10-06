/**
 * A local, tamper-evident commitment over the exact inputs behind a payment
 * decision — not a blockchain attestation, and the UI must never claim it
 * is one. What it actually proves: if you have the original inputs (the
 * proposal, the actor, the policy limits in force at decision time), you
 * can recompute this hash and confirm the recorded decision wasn't edited
 * after the fact. Pure, deterministic, no I/O — computed once, right after
 * lib/payments/execute.ts's server-side policy re-check passes, using Node's
 * built-in crypto (no new dependency).
 *
 * Why this exists: market research into comparable Arc/Tameion AP agents
 * and the emerging "verifiable AI agent" pattern (W3C DIDs/Verifiable
 * Credentials proving an agent was authorized to transact — 2026 industry
 * direction) converged on the same need: evidence that a decision was
 * actually bound to the rules in force, not just a log line someone could
 * have edited. Real DIDs/VCs need external issuer infrastructure this app
 * has no business guessing into existence; this is the lightweight, fully
 * local analog of the same idea — see docs/pitch.md and BUILD_LOG.md,
 * 2026-10-06, for the full reasoning and the alternatives ruled out.
 */
import { createHash } from "node:crypto";

export interface DecisionReceiptInput {
  proposalId: string;
  supplierId: string;
  amountCents: number;
  actorId: string;
  decision: string;
  minimumReserveCents: number;
  businessDailyLimitCents: number;
  confirmationThresholdCents: number;
  /** ISO timestamp of the moment this decision was made. */
  decidedAt: string;
}

/**
 * Deterministic for identical input — field order is fixed explicitly
 * rather than relying on object key insertion order, so this stays stable
 * even if a future refactor reorders how the input object is built.
 */
export function computeDecisionHash(input: DecisionReceiptInput): string {
  const canonical = [
    input.proposalId,
    input.supplierId,
    String(input.amountCents),
    input.actorId,
    input.decision,
    String(input.minimumReserveCents),
    String(input.businessDailyLimitCents),
    String(input.confirmationThresholdCents),
    input.decidedAt,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
