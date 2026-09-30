/**
 * Finance engine. Deterministic, pure functions over business state. No React,
 * Next.js, database or LLM dependencies. All amounts are integer cents.
 */
import type {
  Business,
  Obligation,
  Supplier,
  Transaction,
} from "@/lib/domain/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Current cash balance. */
export function currentBalanceCents(business: Business): number {
  return business.currentBalanceCents;
}

/** Days between two ISO dates (b - a), truncated. Negative if b precedes a. */
function daysBetween(a: string, b: string): number {
  return Math.floor((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);
}

/**
 * Total obligations falling due within `horizonDays` of `asOf` (inclusive of
 * both ends). Obligations already past due (before asOf) are excluded — they are
 * assumed settled.
 */
export function upcomingObligationsCents(
  obligations: readonly Obligation[],
  asOf: string,
  horizonDays = 30,
): number {
  return obligations.reduce((sum, o) => {
    const offset = daysBetween(asOf, o.dueDate);
    return offset >= 0 && offset <= horizonDays ? sum + o.amountCents : sum;
  }, 0);
}

/**
 * Safe-to-spend: cash that may be committed today without breaching the reserve
 * or upcoming obligations.
 *   safeToSpend = balance − obligationsDueNext30Days − minimumReserve
 */
export function safeToSpendCents(params: {
  balanceCents: number;
  obligationsNext30DaysCents: number;
  minimumReserveCents: number;
}): number {
  return (
    params.balanceCents -
    params.obligationsNext30DaysCents -
    params.minimumReserveCents
  );
}

/** Total spent to a supplier so far this calendar month. */
export function supplierMonthToDateCents(supplier: Supplier): number {
  return supplier.spentThisMonthCents;
}

/** Balance after a proposed payment of `amountCents` leaves the account. */
export function projectedBalanceAfterCents(
  balanceCents: number,
  amountCents: number,
): number {
  return balanceCents - amountCents;
}

export interface Forecast30Day {
  startingBalanceCents: number;
  totalObligationsCents: number;
  projectedBalanceCents: number;
}

/**
 * 30-day cash forecast: the projected balance once all obligations due in the
 * next 30 days are paid. Revenue is intentionally excluded — the forecast is a
 * conservative floor of where cash lands if no new money arrives.
 */
export function forecast30Day(
  business: Business,
  obligations: readonly Obligation[],
  asOf: string,
): Forecast30Day {
  const totalObligationsCents = upcomingObligationsCents(obligations, asOf, 30);
  return {
    startingBalanceCents: business.currentBalanceCents,
    totalObligationsCents,
    projectedBalanceCents: business.currentBalanceCents - totalObligationsCents,
  };
}

/** Sum of a set of transactions (signed). Useful for history summaries. */
export function netCashFlowCents(transactions: readonly Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amountCents, 0);
}
