import type { UpcomingObligation } from "@/lib/finance/dashboard";
import { formatEurosDisplay } from "@/lib/money";

function dueLabel(days: number): string {
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${days} days`;
}

export function ObligationsList({
  obligations,
}: {
  obligations: UpcomingObligation[];
}) {
  if (obligations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No obligations due in the next 30 days.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {obligations.map((o) => (
        <li key={o.id} className="flex items-center justify-between py-2.5">
          <div>
            <p className="text-sm font-medium leading-tight">{o.name}</p>
            <p className="text-xs text-muted-foreground">
              {o.category} · {o.dueDate} ({dueLabel(o.daysUntilDue)})
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {formatEurosDisplay(o.amountCents)}
          </span>
        </li>
      ))}
    </ul>
  );
}
