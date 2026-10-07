"use client";

import { useActionState } from "react";

import {
  toggleTransparencyAction,
  type TransparencyToggleResult,
} from "@/app/actions/policies";
import { Button } from "@/components/ui/button";

const INITIAL: TransparencyToggleResult = { status: "idle" };

/**
 * Owner-only opt-in for the public "proof of operations" page. Same
 * authoritative-result pattern as PauseToggle: the action's own returned
 * `enabled` is used over the server-rendered prop the moment it comes back,
 * so the link appears/disappears without waiting on a page refetch.
 */
export function TransparencyToggle({
  enabled,
  canEdit,
  workspaceId,
}: {
  enabled: boolean;
  canEdit: boolean;
  workspaceId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    toggleTransparencyAction,
    INITIAL,
  );

  const currentlyEnabled = state.enabled ?? enabled;
  const publicUrl = `/t/${workspaceId}`;

  return (
    <div className="rounded-lg border border-input bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {currentlyEnabled
              ? "Proof-of-operations page is published"
              : "Public proof-of-operations page"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {currentlyEnabled ? (
              <>
                Anyone with the link can see your executed payments, tx hashes
                and decision hashes — never your balance or policy limits.{" "}
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-primary underline underline-offset-2"
                >
                  {publicUrl}
                </a>
              </>
            ) : (
              "Off by default. Publishes a read-only, no-login page listing executed payments with on-chain proof — never balance or policy limits."
            )}
          </p>
        </div>
        {canEdit ? (
          <form action={formAction}>
            <Button
              type="submit"
              size="sm"
              variant={currentlyEnabled ? "outline" : "default"}
              disabled={isPending}
            >
              {isPending
                ? "Working…"
                : currentlyEnabled
                  ? "Unpublish"
                  : "Publish"}
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
