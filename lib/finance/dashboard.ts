/**
 * Dashboard assembly. Pure functions that combine business state, obligations,
 * transactions and policies into the shapes the dashboard UI renders. No React,
 * Next.js, database or LLM dependencies. All amounts are integer cents.
 */
import type {
  Business,
  Obligation,
  Policies,
  Transaction,
} from "@/lib/domain/types";
import {
  forecast30Day,
  safeToSpendCents,
  upcomingObligationsCents,
} from "@/lib/finance/engine";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days between two ISO dates (b - a), truncated. Negative if b precedes a. */
function daysBetween(a: string, b: string): number {
  return Math.floor((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);
}

/** Add `days` to an ISO date, returning a new YYYY-MM-DD string (UTC). */
function addDays(isoDate: string, days: number): string {
  const d = new Date(Date.parse(isoDate) + days * MS_PER_DAY);
  return d.toISOString().slice(0, 10);
}

/** The safe-to-spend figure alongside the inputs that produced it. */
export interface SafeToSpendBreakdown {
  balanceCents: number;
  obligationsNext30DaysCents: number;
  minimumReserveCents: number;
  safeToSpendCents: number;
}

export function safeToSpendBreakdown(
  business: Business,
  obligations: readonly Obligation[],
  policies: Policies,
  asOf: string,
): SafeToSpendBreakdown {
  const obligationsNext30DaysCents = upcomingObligationsCents(
    obligations,
    asOf,
    30,
  );
  return {
    balanceCents: business.currentBalanceCents,
    obligationsNext30DaysCents,
    minimumReserveCents: policies.minimumReserveCents,
    safeToSpendCents: safeToSpendCents({
      balanceCents: business.currentBalanceCents,
      obligationsNext30DaysCents,
      minimumReserveCents: policies.minimumReserveCents,
    }),
  };
}

/** Obligations due within the horizon, soonest first, with days-until each. */
export interface UpcomingObligation extends Obligation {
  daysUntilDue: number;
}

export function upcomingObligations(
  obligations: readonly Obligation[],
  asOf: string,
  horizonDays = 30,
): UpcomingObligation[] {
  return obligations
    .map((o) => ({ ...o, daysUntilDue: daysBetween(asOf, o.dueDate) }))
    .filter((o) => o.daysUntilDue >= 0 && o.daysUntilDue <= horizonDays)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/** A single point on the forecast line: the projected balance on that date. */
export interface ForecastPoint {
  date: string;
  balanceCents: number;
}

/**
 * Daily projected-balance series across `days` days from `asOf` (inclusive of
 * both ends, so `days + 1` points). Starts at the current balance and steps
 * down as each obligation falls due — a conservative drawdown that assumes no
 * new revenue arrives. The final point equals the 30-day forecast balance.
 */
export function forecastSeries(
  business: Business,
  obligations: readonly Obligation[],
  asOf: string,
  days = 30,
): ForecastPoint[] {
  const dueByDate = new Map<string, number>();
  for (const o of obligations) {
    const offset = daysBetween(asOf, o.dueDate);
    if (offset >= 0 && offset <= days) {
      dueByDate.set(o.dueDate, (dueByDate.get(o.dueDate) ?? 0) + o.amountCents);
    }
  }

  const points: ForecastPoint[] = [];
  let balance = business.currentBalanceCents;
  for (let offset = 0; offset <= days; offset += 1) {
    const date = addDays(asOf, offset);
    balance -= dueByDate.get(date) ?? 0;
    points.push({ date, balanceCents: balance });
  }
  return points;
}

/**
 * Recent transactions, newest first, limited to `limit` rows. Sorts by
 * `createdAt`, not `date` — several transactions can share the same display
 * date (every payment executed "today" lands on one fixed demo-anchor date),
 * and `date` alone can't order those relative to each other.
 */
export function recentTransactions(
  transactions: readonly Transaction[],
  limit = 12,
): Transaction[] {
  return [...transactions]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, limit);
}

export interface DashboardData {
  business: Business;
  safeToSpend: SafeToSpendBreakdown;
  forecast: ReturnType<typeof forecast30Day>;
  forecastSeries: ForecastPoint[];
  obligations: UpcomingObligation[];
  transactions: Transaction[];
}

/** Assemble everything the dashboard renders from the raw state. */
export function buildDashboardData(params: {
  business: Business;
  obligations: readonly Obligation[];
  transactions: readonly Transaction[];
  policies: Policies;
  asOf: string;
}): DashboardData {
  const { business, obligations, transactions, policies, asOf } = params;
  return {
    business,
    safeToSpend: safeToSpendBreakdown(business, obligations, policies, asOf),
    forecast: forecast30Day(business, obligations, asOf),
    forecastSeries: forecastSeries(business, obligations, asOf, 30),
    obligations: upcomingObligations(obligations, asOf, 30),
    transactions: recentTransactions(transactions, 12),
  };
}
