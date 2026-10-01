"use client";

import { useActionState } from "react";

import {
  createWorkspaceAction,
  type OnboardingResult,
} from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { inputClass, TextField } from "@/components/ui/field";

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
        <TextField
          id="businessName"
          name="businessName"
          label="Your business name"
          required
          maxLength={80}
          placeholder="e.g. Riverside Bakery"
          error={state.fieldErrors?.businessName}
        />
        <TextField
          id="ownerName"
          name="ownerName"
          label="Your name"
          required
          maxLength={60}
          placeholder="e.g. Sam"
          error={state.fieldErrors?.ownerName}
        />
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
