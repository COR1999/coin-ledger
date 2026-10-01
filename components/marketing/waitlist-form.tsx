"use client";

import { useActionState } from "react";

import {
  joinWaitlistAction,
  type WaitlistResult,
} from "@/app/actions/waitlist";
import { Button } from "@/components/ui/button";

const INITIAL: WaitlistResult = { status: "idle" };

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive";

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
        <div className="flex flex-col gap-1">
          <label htmlFor="wl-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="wl-name"
            name="name"
            type="text"
            required
            maxLength={80}
            aria-invalid={state.fieldErrors?.name ? true : undefined}
            className={inputClass}
          />
          {state.fieldErrors?.name ? (
            <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="wl-email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="wl-email"
            name="email"
            type="email"
            required
            maxLength={120}
            aria-invalid={state.fieldErrors?.email ? true : undefined}
            className={inputClass}
          />
          {state.fieldErrors?.email ? (
            <p className="text-xs text-destructive">
              {state.fieldErrors.email}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="wl-businessType" className="text-sm font-medium">
          What kind of business?
        </label>
        <input
          id="wl-businessType"
          name="businessType"
          type="text"
          required
          maxLength={60}
          placeholder="e.g. Café, freelance design, retail"
          aria-invalid={state.fieldErrors?.businessType ? true : undefined}
          className={inputClass}
        />
        {state.fieldErrors?.businessType ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.businessType}
          </p>
        ) : null}
      </div>
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
