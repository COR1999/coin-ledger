"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  approveProposal,
  confirmProposal,
  rejectProposal,
  retryPayment,
} from "@/app/actions/approvals";
import { arcExplorerTxUrl, DEMO_SCALE_LABEL } from "@/lib/config";

interface Proposal {
  id: string;
  supplierName: string;
  amount: string;
  reason: string;
  proposedBy: string;
  status: string;
  policyDecision: string;
  requiredApproverRole: string | null;
  requiresConfirmation: boolean;
  approvedBy: string | null;
  txHash: string | null;
  onChainAmount: string | null;
  failureReason: string | null;
}

interface ActionState {
  status: "loading" | "done" | "error";
  errorMessage?: string;
  txHash?: string;
  onChainAmount?: string;
  /** The proposal's real resulting status, straight from the server action
   * — see ActionResult's own comment in app/actions/approvals.ts for why
   * this exists instead of guessing from txHash/action type. */
  resultStatus?: string;
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Awaiting approval";
    case "approved":
      return "Approved";
    case "awaiting_confirmation":
      return "Awaiting confirmation";
    case "confirmed":
      return "Confirmed";
    case "executing":
      return "Executing";
    case "executed":
      return "Executed";
    case "failed":
      return "Failed";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

/** Outlined "seal" style — a border in the status colour, no fill — rather
 * than a filled pill. See docs/spec/brand.md's Ledger direction. */
function statusColor(status: string): string {
  switch (status) {
    case "pending":
    case "awaiting_confirmation":
      return "text-amber-700 border-amber-600 dark:text-amber-400";
    case "approved":
    case "confirmed":
      return "text-blue-700 border-blue-600 dark:text-blue-400";
    case "executed":
      return "text-emerald-700 border-emerald-600 dark:text-emerald-400";
    case "failed":
    case "rejected":
      return "text-red-700 border-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground border-muted-foreground/40";
  }
}

export function ProposalList({
  proposals,
  currentActorRole,
}: {
  proposals: Proposal[];
  currentActorRole: string;
}) {
  const router = useRouter();
  const [actionState, setActionState] = useState<Record<string, ActionState>>(
    {},
  );

  async function handleAction(
    proposalId: string,
    action: "approve" | "confirm" | "reject" | "retry",
  ) {
    setActionState((s) => ({ ...s, [proposalId]: { status: "loading" } }));
    const fn =
      action === "approve"
        ? approveProposal
        : action === "confirm"
          ? confirmProposal
          : action === "retry"
            ? retryPayment
            : rejectProposal;

    const result = await fn(proposalId);
    setActionState((s) => ({
      ...s,
      [proposalId]: result.success
        ? {
            status: "done",
            txHash: result.txHash,
            onChainAmount: result.onChainAmount,
            resultStatus: result.status,
          }
        : // Still an error (shows the message, see below) — but if the
          // server also reports the proposal's real resulting status (an
          // execution that failed *after* already mutating the proposal,
          // not a permission check that changed nothing), carry it so
          // effectiveStatus doesn't fall back to a now-stale p.status for
          // the same staleness-window reason the success path was fixed.
          {
            status: "error",
            errorMessage: result.message,
            resultStatus: result.status,
          },
    }));
    router.refresh();
  }

  if (proposals.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No payment proposals yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {proposals.map((p) => {
        // `router.refresh()` asks Next to re-fetch this page's server data,
        // but that round trip isn't instant — confirmed live (2026-10-06)
        // that a successful confirm/approve/retry can genuinely execute a
        // payment (real tx hash) while this component still renders the
        // *previous* server-provided `p.status` ("awaiting confirmation",
        // stale action buttons still clickable) for several seconds, until
        // a hard reload catches up. Rather than trust that round trip to
        // always land in time or guess the outcome from a tx hash, the
        // server action now returns the proposal's real resulting status
        // directly (ActionResult.status) — once an action succeeds, this
        // component treats that as authoritative for *everything* status
        // drives below (the badge, the button set to show), not just the
        // "executed" banner. An earlier version of this fix only special-
        // cased "has a tx hash" and left every other successful outcome
        // (a plain reject; an approve that still needs confirmation) stuck
        // on a vague "Updating…" with no buttons until refresh() landed —
        // both found live, both fixed by trusting the server's own answer
        // instead of inferring it client-side. `resultStatus` can also
        // arrive on a `success: false` result (an execution that failed
        // *after* already mutating the proposal to "failed" server-side) —
        // keyed on its presence, not on `status === "done"`, so that case
        // gets the same fix rather than falling back to a stale p.status.
        const effectiveStatus = actionState[p.id]?.resultStatus ?? p.status;

        return (
          <div
            key={p.id}
            className="rounded-sm border border-t-2 border-t-accent bg-background p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.supplierName}</span>
                  <span className="font-mono text-lg font-semibold">
                    {p.amount}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {p.reason} — proposed by {p.proposedBy}
                </p>
                {p.requiredApproverRole && effectiveStatus === "pending" && (
                  <p className="mt-1 text-xs text-amber-600">
                    Requires {p.requiredApproverRole} approval
                  </p>
                )}
                {p.approvedBy && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Approved by {p.approvedBy}
                  </p>
                )}
              </div>
              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${statusColor(effectiveStatus)}`}
              >
                {statusLabel(effectiveStatus)}
              </span>
            </div>

            {actionState[p.id]?.status === "error" && (
              <p className="mt-2 text-xs text-red-600">
                {actionState[p.id].errorMessage}
              </p>
            )}

            {effectiveStatus === "failed" &&
              actionState[p.id]?.status !== "error" &&
              p.failureReason && (
                <p className="mt-2 text-xs text-red-600">
                  Execution failed: {p.failureReason}
                </p>
              )}

            {(effectiveStatus === "approved" ||
              effectiveStatus === "confirmed") &&
              !(actionState[p.id]?.txHash ?? p.txHash) &&
              actionState[p.id]?.status !== "error" && (
                <p className="mt-2 text-xs text-amber-600">
                  This payment was approved but never executed — the request
                  that should have submitted it was interrupted. Retry to submit
                  it now.
                </p>
              )}

            {effectiveStatus === "executing" &&
              !(actionState[p.id]?.txHash ?? p.txHash) &&
              actionState[p.id]?.status !== "error" && (
                <p className="mt-2 text-xs text-amber-600">
                  This payment was submitted but its outcome wasn&apos;t
                  confirmed in time. Retry to check the result — this resumes
                  checking the same payment rather than sending a second one.
                </p>
              )}

            {(actionState[p.id]?.txHash ?? p.txHash) && (
              <div className="mt-2 rounded-sm border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <p className="font-mono">
                  Executed on-chain:{" "}
                  {actionState[p.id]?.onChainAmount ?? p.onChainAmount} (
                  {DEMO_SCALE_LABEL})
                </p>
                <p className="mt-0.5 break-all font-mono">
                  Tx:{" "}
                  <a
                    href={arcExplorerTxUrl(
                      (actionState[p.id]?.txHash ?? p.txHash) as string,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {actionState[p.id]?.txHash ?? p.txHash}
                  </a>
                </p>
              </div>
            )}

            {/* Gated on `effectiveStatus`, not the raw server `p.status` —
                once an action succeeds, the server tells this component the
                real resulting status (see the comment above), so the next
                legal action's buttons appear immediately instead of waiting
                on `router.refresh()`'s round trip. */}
            <div className="mt-3 flex gap-2">
              {effectiveStatus === "pending" &&
                (currentActorRole === "owner" ||
                  currentActorRole === "accountant") && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleAction(p.id, "approve")}
                      disabled={actionState[p.id]?.status === "loading"}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(p.id, "reject")}
                      disabled={actionState[p.id]?.status === "loading"}
                    >
                      Reject
                    </Button>
                  </>
                )}

              {effectiveStatus === "awaiting_confirmation" &&
                (currentActorRole === "owner" ||
                  currentActorRole === "accountant") && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleAction(p.id, "confirm")}
                      disabled={actionState[p.id]?.status === "loading"}
                    >
                      Confirm payment
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(p.id, "reject")}
                      disabled={actionState[p.id]?.status === "loading"}
                    >
                      Cancel
                    </Button>
                  </>
                )}

              {(effectiveStatus === "failed" ||
                ((effectiveStatus === "approved" ||
                  effectiveStatus === "confirmed" ||
                  effectiveStatus === "executing") &&
                  !(actionState[p.id]?.txHash ?? p.txHash))) &&
                (currentActorRole === "owner" ||
                  currentActorRole === "accountant") && (
                  <Button
                    size="sm"
                    onClick={() => handleAction(p.id, "retry")}
                    disabled={actionState[p.id]?.status === "loading"}
                  >
                    {actionState[p.id]?.status === "loading"
                      ? "Retrying..."
                      : "Retry payment"}
                  </Button>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
