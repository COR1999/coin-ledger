"use client";

import { useState } from "react";

import { toggleSupplierBlockedAction } from "@/app/actions/suppliers";
import { Button } from "@/components/ui/button";

interface SupplierRow {
  id: string;
  name: string;
  category: string;
  monthlyLimit: string;
  employeeApproved: boolean;
  blocked: boolean;
}

interface RowState {
  status: "loading" | "done" | "error";
  blocked?: boolean;
  errorMessage?: string;
}

/**
 * Owner-only supplier blocklist management. Inspired by Circle's Compliance
 * Engine documenting allowlists/blocklists as a standard wallet-risk
 * primitive (market research, 2026-10-06) — this is a local, always-on
 * equivalent enforced by the policy engine itself
 * (packages/agent-policy-gate's Rule 0), not a call to that API.
 */
export function SupplierList({
  suppliers,
  canEdit,
}: {
  suppliers: SupplierRow[];
  canEdit: boolean;
}) {
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  async function handleToggle(supplierId: string) {
    setRowState((s) => ({ ...s, [supplierId]: { status: "loading" } }));
    const result = await toggleSupplierBlockedAction(supplierId);
    setRowState((s) => ({
      ...s,
      [supplierId]: result.success
        ? { status: "done", blocked: result.blocked }
        : { status: "error", errorMessage: result.message },
    }));
  }

  if (suppliers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No suppliers on file yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {suppliers.map((s) => {
        const row = rowState[s.id];
        const effectiveBlocked =
          row?.status === "done" && row.blocked !== undefined
            ? row.blocked
            : s.blocked;

        return (
          <div
            key={s.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 ${
              effectiveBlocked
                ? "border-red-600/40 bg-red-50 dark:bg-red-950/20"
                : "border-input"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {s.name}{" "}
                {effectiveBlocked && (
                  <span className="font-mono text-[11px] uppercase tracking-wide text-red-700 dark:text-red-400">
                    Blocked
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.category} · Monthly limit: {s.monthlyLimit}
                {!s.employeeApproved && " · Not on the employee-approved list"}
              </p>
              {row?.status === "error" && (
                <p aria-live="polite" className="mt-1 text-xs text-red-600">
                  {row.errorMessage}
                </p>
              )}
            </div>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                variant={effectiveBlocked ? "default" : "outline"}
                disabled={row?.status === "loading"}
                onClick={() => handleToggle(s.id)}
                aria-label={`${effectiveBlocked ? "Unblock" : "Block"} ${s.name}`}
              >
                {row?.status === "loading"
                  ? "Working…"
                  : effectiveBlocked
                    ? "Unblock"
                    : "Block"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
