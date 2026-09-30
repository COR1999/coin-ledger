"use client";

import { useActionState } from "react";

import {
  updatePoliciesAction,
  type PolicyUpdateResult,
} from "@/app/actions/policies";
import { Button } from "@/components/ui/button";
import type { PolicyForm as PolicyFormValues } from "@/lib/policy/settings";

const INITIAL: PolicyUpdateResult = { status: "idle" };

interface FieldDef {
  name: keyof PolicyFormValues;
  label: string;
  hint?: string;
}

const GROUPS: { legend: string; fields: FieldDef[] }[] = [
  {
    legend: "Business-wide",
    fields: [
      {
        name: "minimumReserve",
        label: "Minimum reserve (€)",
        hint: "Cash kept untouched; part of safe-to-spend.",
      },
      {
        name: "businessDailyLimit",
        label: "Business daily limit (€)",
        hint: "Total spend allowed across all roles per day.",
      },
      {
        name: "confirmationThreshold",
        label: "Confirmation threshold (€)",
        hint: "Payments above this need explicit human confirmation.",
      },
    ],
  },
  {
    legend: "Owner",
    fields: [
      { name: "ownerMaxSinglePayment", label: "Max single payment (€)" },
    ],
  },
  {
    legend: "Accountant",
    fields: [
      { name: "accountantMaxSinglePayment", label: "Max single payment (€)" },
      { name: "accountantDailyLimit", label: "Daily limit (€)" },
    ],
  },
  {
    legend: "Employee",
    fields: [
      { name: "employeeMaxSinglePayment", label: "Max single payment (€)" },
      { name: "employeeDailyLimit", label: "Daily limit (€)" },
    ],
  },
];

export function PolicyForm({
  values,
  canEdit,
}: {
  values: PolicyFormValues;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updatePoliciesAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-6">
      {!canEdit ? (
        <p
          role="note"
          className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          Policies are read-only for your role. Switch to the owner (Mario) to
          make changes.
        </p>
      ) : null}

      {GROUPS.map((group) => (
        <fieldset key={group.legend} className="space-y-3" disabled={!canEdit}>
          <legend className="text-sm font-semibold">{group.legend}</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.fields.map((field) => {
              const error = state.fieldErrors?.[field.name];
              return (
                <div key={field.name} className="flex flex-col gap-1">
                  <label htmlFor={field.name} className="text-sm font-medium">
                    {field.label}
                  </label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="text"
                    inputMode="decimal"
                    defaultValue={values[field.name]}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={
                      error
                        ? `${field.name}-error`
                        : field.hint
                          ? `${field.name}-hint`
                          : undefined
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-[invalid=true]:border-destructive"
                  />
                  {field.hint && !error ? (
                    <p
                      id={`${field.name}-hint`}
                      className="text-xs text-muted-foreground"
                    >
                      {field.hint}
                    </p>
                  ) : null}
                  {error ? (
                    <p
                      id={`${field.name}-error`}
                      className="text-xs text-destructive"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save policies"}
          </Button>
          <p aria-live="polite" className="text-sm">
            {state.status === "success" ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                {state.message}
              </span>
            ) : state.status === "error" ? (
              <span className="text-destructive">{state.message}</span>
            ) : null}
          </p>
        </div>
      ) : null}
    </form>
  );
}
