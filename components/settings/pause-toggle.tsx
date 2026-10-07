"use client";

import { useActionState } from "react";

import {
  togglePaymentsPausedAction,
  type PauseToggleResult,
} from "@/app/actions/policies";
import { Button } from "@/components/ui/button";

const INITIAL: PauseToggleResult = { status: "idle" };

/**
 * Emergency circuit breaker, owner-only. Deliberately not part of
 * PolicyForm's batch "edit limits, then Save" flow — this is a one-click
 * safety action for "something looks wrong, stop everything now", not a
 * value to fill in and remember to submit. Modeled on the pause control a
 * comparable Arc/Tameion hackathon AP agent documents as a standard safety
 * feature; see lib/domain/types.ts's Policies.paymentsPaused.
 */
export function PauseToggle({
  paused,
  canEdit,
}: {
  paused: boolean;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    togglePaymentsPausedAction,
    INITIAL,
  );

  // The server action's own result is authoritative the moment it comes
  // back, same reasoning as the approvals staleness fix — don't wait on a
  // page-data refetch to show the state that already changed.
  const currentlyPaused = state.paused ?? paused;

  return (
    <div
      className={`rounded-lg border p-4 ${
        currentlyPaused
          ? "border-red-600/40 bg-red-50 dark:bg-red-950/20"
          : "border-input bg-muted/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {currentlyPaused
              ? "All payments are paused"
              : "Emergency payment pause"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {currentlyPaused
              ? canEdit
                ? "No proposal can execute, and the agent won't create new ones, until you resume."
                : "No proposal can execute, and the agent won't create new ones, until the owner resumes."
              : "Immediately blocks every payment — new and already-approved — until resumed. Re-checked at the moment each payment would execute, not just when proposed."}
          </p>
        </div>
        {canEdit ? (
          <form action={formAction}>
            <Button
              type="submit"
              size="sm"
              variant={currentlyPaused ? "default" : "outline"}
              disabled={isPending}
            >
              {isPending
                ? "Working…"
                : currentlyPaused
                  ? "Resume payments"
                  : "Pause all payments"}
            </Button>
          </form>
        ) : null}
      </div>
      {state.status === "error" && (
        <p aria-live="polite" className="mt-2 text-xs text-red-600">
          {state.message}
        </p>
      )}
    </div>
  );
}
