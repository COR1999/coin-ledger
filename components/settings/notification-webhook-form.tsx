"use client";

import { useActionState } from "react";

import {
  updateNotificationWebhookAction,
  type NotificationWebhookResult,
} from "@/app/actions/policies";
import { Button } from "@/components/ui/button";

const INITIAL: NotificationWebhookResult = { status: "idle" };

/**
 * Owner-only. A Slack/Discord incoming webhook URL, or any generic JSON
 * listener — notified the moment a proposal needs a human to act, so a
 * real owner doesn't have to remember to poll /approvals. See
 * lib/notify/webhook.ts for the payload shapes and the SSRF guard on the
 * URL itself.
 */
export function NotificationWebhookForm({
  webhookUrl,
  canEdit,
}: {
  webhookUrl: string | undefined;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateNotificationWebhookAction,
    INITIAL,
  );

  const currentValue = state.webhookUrl ?? webhookUrl ?? "";

  return (
    <div className="rounded-lg border border-input bg-muted/20 p-4">
      <p className="text-sm font-semibold">Approval notifications</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Paste a Slack or Discord incoming webhook URL (or any JSON listener).
        You&rsquo;ll be notified the moment a payment needs approval or
        confirmation — leave blank to turn notifications off.
      </p>
      {canEdit ? (
        <form action={formAction} className="mt-3 flex flex-wrap gap-2">
          <input
            type="url"
            name="webhookUrl"
            defaultValue={currentValue}
            placeholder="https://hooks.slack.com/services/..."
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {currentValue ? "A webhook is configured." : "No webhook configured."}
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-2 text-xs text-red-600">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="mt-2 text-xs text-emerald-600">{state.message}</p>
      )}
    </div>
  );
}
