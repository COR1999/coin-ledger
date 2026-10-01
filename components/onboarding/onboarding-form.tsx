"use client";

import { useActionState } from "react";

import {
  createWorkspaceAction,
  type OnboardingResult,
} from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";

const INITIAL: OnboardingResult = { status: "idle" };

const SUPPLIER_ROWS = [1, 2, 3];

/** Short onboarding wizard: business name, owner name, up to 3 suppliers. */
export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(
    createWorkspaceAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="businessName"
          label="Your business name"
          error={state.fieldErrors?.businessName}
        >
          <input
            id="businessName"
            name="businessName"
            type="text"
            required
            maxLength={80}
            placeholder="e.g. Riverside Bakery"
            aria-invalid={state.fieldErrors?.businessName ? true : undefined}
            className={inputClass}
          />
        </Field>
        <Field
          id="ownerName"
          label="Your name"
          error={state.fieldErrors?.ownerName}
        >
          <input
            id="ownerName"
            name="ownerName"
            type="text"
            required
            maxLength={60}
            placeholder="e.g. Sam"
            aria-invalid={state.fieldErrors?.ownerName ? true : undefined}
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">
          Suppliers you pay regularly
        </legend>
        <p className="text-xs text-muted-foreground">
          At least one. Rows 2 and 3 are optional — leave a name blank to skip
          it.
        </p>
        {state.fieldErrors?.suppliers ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.suppliers}
          </p>
        ) : null}
        <div className="space-y-3">
          {SUPPLIER_ROWS.map((n) => (
            <div key={n} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`supplier${n}Name`}
                  className="text-sm font-medium"
                >
                  Supplier {n} name{n === 1 ? "" : " (optional)"}
                </label>
                <input
                  id={`supplier${n}Name`}
                  name={`supplier${n}Name`}
                  type="text"
                  maxLength={60}
                  placeholder="e.g. City Flour Co."
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`supplier${n}Category`}
                  className="text-sm font-medium"
                >
                  Category
                </label>
                <input
                  id={`supplier${n}Category`}
                  name={`supplier${n}Category`}
                  type="text"
                  maxLength={40}
                  placeholder="e.g. Ingredients"
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating your workspace…" : "Create my workspace"}
        </Button>
        <p aria-live="polite" className="text-sm">
          {state.status === "error" ? (
            <span className="text-destructive">{state.message}</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
