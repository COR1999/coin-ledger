"use client";

import { useActionState } from "react";

import {
  joinWaitlistAction,
  type WaitlistResult,
} from "@/app/actions/waitlist";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

const INITIAL: WaitlistResult = { status: "idle" };

export function WaitlistForm() {
  const [state, formAction, isPending] = useActionState(
    joinWaitlistAction,
    INITIAL,
  );

  if (state.status === "success") {
    return (
      <p
        role="status"
        className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="wl-name"
          name="name"
          label="Name"
          type="text"
          required
          maxLength={80}
          error={state.fieldErrors?.name}
        />
        <TextField
          id="wl-email"
          name="email"
          label="Email"
          type="email"
          required
          maxLength={120}
          error={state.fieldErrors?.email}
        />
      </div>
      <TextField
        id="wl-businessType"
        name="businessType"
        label="What kind of business?"
        type="text"
        required
        maxLength={60}
        placeholder="e.g. Café, freelance design, retail"
        error={state.fieldErrors?.businessType}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Joining…" : "Join the waitlist"}
        </Button>
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
