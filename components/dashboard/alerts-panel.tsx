import { AlertTriangle, Bell, Info } from "lucide-react";

import type { Alert, AlertSeverity } from "@/lib/finance/alerts";
import { cn } from "@/lib/utils";

const SEVERITY: Record<
  AlertSeverity,
  { icon: typeof Info; label: string; box: string; iconClass: string }
> = {
  critical: {
    icon: AlertTriangle,
    label: "Critical",
    box: "border-destructive/40 bg-destructive/5",
    iconClass: "text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    box: "border-amber-500/40 bg-amber-500/5",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    label: "Info",
    box: "border-border bg-muted/40",
    iconClass: "text-muted-foreground",
  },
};

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Bell className="size-4" aria-hidden />
        <span>No alerts — the cash position is healthy.</span>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Financial alerts">
      {alerts.map((alert) => {
        const s = SEVERITY[alert.severity];
        const Icon = s.icon;
        return (
          <li
            key={alert.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              s.box,
            )}
          >
            <Icon
              className={cn("mt-0.5 size-4 shrink-0", s.iconClass)}
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium">
                <span className="sr-only">{s.label}: </span>
                {alert.title}
              </p>
              <p className="text-sm text-muted-foreground">{alert.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
