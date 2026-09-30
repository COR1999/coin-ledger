/**
 * Alert derivation. Pure functions that turn business state into the warnings
 * the dashboard surfaces. No React, Next.js, database or LLM dependencies. All
 * amounts are integer cents.
 */
import type { Obligation, Supplier } from "@/lib/domain/types";
import { formatEurosDisplay } from "@/lib/money";
import type { SafeToSpendBreakdown } from "@/lib/finance/dashboard";

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

/** A supplier is flagged once month-to-date spend reaches this share of its cap. */
const SUPPLIER_LIMIT_WARNING_RATIO = 0.8;
/** Obligations due within this many days are surfaced as imminent. */
const IMMINENT_OBLIGATION_DAYS = 3;

export function computeAlerts(params: {
  safeToSpend: SafeToSpendBreakdown;
  suppliers: readonly Supplier[];
  obligations: readonly { obligation: Obligation; daysUntilDue: number }[];
}): Alert[] {
  const { safeToSpend, suppliers, obligations } = params;
  const alerts: Alert[] = [];

  // Safe-to-spend exhausted: obligations + reserve exceed available cash.
  if (safeToSpend.safeToSpendCents <= 0) {
    alerts.push({
      id: "safe-to-spend-exhausted",
      severity: "critical",
      title: "No safe-to-spend headroom",
      detail: `Upcoming obligations and the ${formatEurosDisplay(
        safeToSpend.minimumReserveCents,
      )} reserve leave nothing free to commit today.`,
    });
  } else if (safeToSpend.safeToSpendCents < safeToSpend.minimumReserveCents) {
    alerts.push({
      id: "safe-to-spend-low",
      severity: "warning",
      title: "Safe-to-spend is running low",
      detail: `Only ${formatEurosDisplay(
        safeToSpend.safeToSpendCents,
      )} is free to commit after obligations and the reserve.`,
    });
  }

  // Forecast balance dipping below the minimum reserve once obligations clear.
  const forecastBalanceCents =
    safeToSpend.balanceCents - safeToSpend.obligationsNext30DaysCents;
  if (forecastBalanceCents < safeToSpend.minimumReserveCents) {
    alerts.push({
      id: "forecast-below-reserve",
      severity: "warning",
      title: "30-day forecast dips below reserve",
      detail: `After the next 30 days of obligations, projected cash is ${formatEurosDisplay(
        forecastBalanceCents,
      )} — under the ${formatEurosDisplay(
        safeToSpend.minimumReserveCents,
      )} reserve.`,
    });
  }

  // Suppliers approaching or over their monthly cap.
  for (const s of suppliers) {
    if (s.monthlyLimitCents === null) continue;
    const ratio = s.spentThisMonthCents / s.monthlyLimitCents;
    if (s.spentThisMonthCents >= s.monthlyLimitCents) {
      alerts.push({
        id: `supplier-over-${s.id}`,
        severity: "critical",
        title: `${s.name} is at its monthly limit`,
        detail: `${formatEurosDisplay(
          s.spentThisMonthCents,
        )} spent of a ${formatEurosDisplay(s.monthlyLimitCents)} cap this month.`,
      });
    } else if (ratio >= SUPPLIER_LIMIT_WARNING_RATIO) {
      alerts.push({
        id: `supplier-near-${s.id}`,
        severity: "warning",
        title: `${s.name} is near its monthly limit`,
        detail: `${formatEurosDisplay(
          s.spentThisMonthCents,
        )} of ${formatEurosDisplay(s.monthlyLimitCents)} spent this month.`,
      });
    }
  }

  // Obligations due imminently.
  for (const { obligation, daysUntilDue } of obligations) {
    if (daysUntilDue < 0 || daysUntilDue > IMMINENT_OBLIGATION_DAYS) continue;
    const when =
      daysUntilDue === 0
        ? "today"
        : daysUntilDue === 1
          ? "tomorrow"
          : `in ${daysUntilDue} days`;
    alerts.push({
      id: `obligation-due-${obligation.id}`,
      severity: "info",
      title: `${obligation.name} due ${when}`,
      detail: `${formatEurosDisplay(obligation.amountCents)} due on ${
        obligation.dueDate
      }.`,
    });
  }

  return alerts;
}
