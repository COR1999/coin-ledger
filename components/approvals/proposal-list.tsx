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

function statusColor(status: string): string {
  switch (status) {
    case "pending":
    case "awaiting_confirmation":
      return "text-amber-600 bg-amber-50";
    case "approved":
    case "confirmed":
      return "text-blue-600 bg-blue-50";
    case "executed":
      return "text-green-600 bg-green-50";
    case "failed":
    case "rejected":
      return "text-red-600 bg-red-50";
    default:
      return "text-muted-foreground bg-muted";
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
          }
        : { status: "error", errorMessage: result.message },
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
      {proposals.map((p) => (
        <div key={p.id} className="rounded-lg border bg-background p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.supplierName}</span>
                <span className="text-lg font-semibold">{p.amount}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {p.reason} — proposed by {p.proposedBy}
              </p>
              {p.requiredApproverRole && p.status === "pending" && (
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
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(p.status)}`}
            >
              {statusLabel(p.status)}
            </span>
          </div>

          {actionState[p.id]?.status === "error" && (
            <p className="mt-2 text-xs text-red-600">
              {actionState[p.id].errorMessage}
            </p>
          )}

          {p.status === "failed" &&
            actionState[p.id]?.status !== "error" &&
            p.failureReason && (
              <p className="mt-2 text-xs text-red-600">
                Execution failed: {p.failureReason}
              </p>
            )}

          {(p.status === "approved" || p.status === "confirmed") &&
            !p.txHash &&
            actionState[p.id]?.status !== "error" && (
              <p className="mt-2 text-xs text-amber-600">
                This payment was approved but never executed — the request
                that should have submitted it was interrupted. Retry to
                submit it now.
              </p>
            )}

          {(actionState[p.id]?.txHash ?? p.txHash) && (
            <div className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <p>
                Executed on-chain:{" "}
                {actionState[p.id]?.onChainAmount ?? p.onChainAmount} (
                {DEMO_SCALE_LABEL})
              </p>
              <p className="mt-0.5">
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

          <div className="mt-3 flex gap-2">
            {p.status === "pending" &&
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

            {p.status === "awaiting_confirmation" &&
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

            {(p.status === "failed" ||
              ((p.status === "approved" || p.status === "confirmed") &&
                !p.txHash)) &&
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
      ))}
    </div>
  );
}
