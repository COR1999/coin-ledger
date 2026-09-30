import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SafeToSpendBreakdown } from "@/lib/finance/dashboard";
import { formatEurosDisplay } from "@/lib/money";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  valueCents,
  hint,
  tone = "default",
}: {
  title: string;
  valueCents: number;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums",
            tone === "positive" && "text-emerald-600 dark:text-emerald-400",
            tone === "negative" && "text-destructive",
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

/** Safe-to-spend with its formula spelled out, so the number is explainable. */
export function SafeToSpendCard({ b }: { b: SafeToSpendBreakdown }) {
  const negative = b.safeToSpendCents <= 0;
  return (
    <Card className={negative ? "border-destructive/50" : undefined}>
      <CardHeader>
        <CardTitle>Safe to spend today</CardTitle>
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
