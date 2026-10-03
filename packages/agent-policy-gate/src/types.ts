/**
 * Domain types for the policy gate. Deliberately duplicated from, not
 * imported from, the host app's own domain types — this package has zero
 * dependency on the app it was extracted from, by design. If you fork this
 * package, these are the only types you need to adapt to your own app.
 */

/** Ships with a 3-tier owner/accountant/employee hierarchy as a documented
 * convention, not a hard protocol requirement — adjust this type and the
 * escalation order in engine.ts if your hierarchy has a different shape. */
export type Role = "owner" | "accountant" | "employee";

export type Decision = "allowed" | "needs_approval" | "rejected";

export interface Actor {
  name: string;
  role: Role;
}

/** The counterparty a payment would go to. */
export interface Payee {
  name: string;
  /** May the lowest-trust role pay this payee without escalation? */
  approved: boolean;
  /** Cap on total spend to this payee per calendar month, or null for none. */
  monthlyLimitCents: number | null;
  /** Spend to this payee so far this calendar month. */
  spentThisMonthCents: number;
}

/** Per-role limits. `null` means "not applicable" for that role. */
export interface RoleLimits {
  /** Largest single payment this role may initiate. */
  maxSinglePaymentCents: number;
  /** Cap on this role's own payments per day, or null for no cap (owner). */
  dailyLimitCents: number | null;
  /** Largest amount this role may approve for others, or null if it cannot. */
  approvalLimitCents: number | null;
  /** The lowest-trust role may only pay approved payees. */
  restrictedToApprovedPayees: boolean;
}

export interface Policies {
  roles: Record<Role, RoleLimits>;
  /** Total spend allowed across all roles per day. */
  businessDailyLimitCents: number;
  /** Cash that must remain untouched (part of safe-to-spend). */
  minimumReserveCents: number;
  /** Payments strictly above this require explicit human confirmation. */
  confirmationThresholdCents: number;
}
