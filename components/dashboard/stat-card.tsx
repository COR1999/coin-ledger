import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SafeToSpendBreakdown } from "@/lib/finance/dashboard";
import { formatEurosDisplay } from "@/lib/money";
import { cn } from "@/lib/utils";

type Accent = "neutral" | "info" | "caution" | "positive" | "danger";

/** Chip (icon) styling per semantic accent. Colour always pairs with an icon. */
const CHIP: Record<Accent, string> = {
  neutral: "bg-primary/10 text-primary",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  caution: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  danger: "bg-destructive/10 text-destructive",
};

const VALUE_TONE = {
  default: "",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-destructive",
} as const;

export function StatCard({
  title,
  valueCents,
  hint,
  tone = "default",
  accent = "neutral",
  icon: Icon,
}: {
  title: string;
  valueCents: number;
  hint?: string;
  tone?: keyof typeof VALUE_TONE;
  accent?: Accent;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {Icon ? (
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                CHIP[accent],
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums",
            VALUE_TONE[tone],
          )}
        >
          {formatEurosDisplay(valueCents)}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Safe-to-spend — the product's headline answer ("what can I safely commit
 * today?"), so it gets hero treatment: an emerald wash when there is headroom,
 * a red wash when there is none.
 */
export function SafeToSpendCard({
  b,
  icon: Icon,
}: {
  b: SafeToSpendBreakdown;
  icon?: LucideIcon;
}) {
  const negative = b.safeToSpendCents <= 0;
  return (
    <Card
      className={cn(
        "ring-1",
        negative
          ? "border-destructive/40 bg-destructive/5 ring-destructive/20"
          : "border-emerald-500/40 bg-emerald-500/5 ring-emerald-500/20",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle
            className={
              negative
                ? "text-destructive"
                : "text-emerald-700 dark:text-emerald-400"
            }
          >
            Safe to spend today
          </CardTitle>
          {Icon ? (
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                negative
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums",
            negative
              ? "text-destructive"
              : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {formatEurosDisplay(b.safeToSpendCents)}
        </p>
        <dl className="mt-3 space-y-1 text-sm">
          <FormulaRow label="Current balance" cents={b.balanceCents} />
          <FormulaRow
            label="Less obligations (30 days)"
            cents={-b.obligationsNext30DaysCents}
          />
          <FormulaRow
            label="Less minimum reserve"
            cents={-b.minimumReserveCents}
          />
          <div className="mt-1 flex items-center justify-between border-t pt-1 font-medium">
            <dt>Safe to spend</dt>
            <dd className="tabular-nums">
              {formatEurosDisplay(b.safeToSpendCents)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function FormulaRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatEurosDisplay(cents)}</dd>
    </div>
  );
}
