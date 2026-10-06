import { describe, expect, it } from "vitest";

import type { Supplier } from "@/lib/domain/types";
import { eur } from "@/lib/money";
import type { SafeToSpendBreakdown } from "./dashboard";
import { computeAlerts } from "./alerts";

const healthySafeToSpend: SafeToSpendBreakdown = {
  balanceCents: eur(18_420),
  obligationsNext30DaysCents: eur(9_730),
  minimumReserveCents: eur(3_000),
  committedProposalsCents: eur(0),
  safeToSpendCents: eur(5_690),
};

const abcCoffee: Supplier = {
  id: "abc-coffee",
  name: "ABC Coffee",
  category: "Coffee beans",
  employeeApproved: true,
  monthlyLimitCents: eur(8_000),
  spentThisMonthCents: eur(4_600),
  blocked: false,
};

describe("computeAlerts", () => {
  it("is quiet for a healthy position", () => {
    const alerts = computeAlerts({
      safeToSpend: healthySafeToSpend,
      suppliers: [abcCoffee],
      obligations: [],
    });
    expect(alerts).toEqual([]);
  });

  it("flags exhausted safe-to-spend as critical", () => {
    const alerts = computeAlerts({
      safeToSpend: {
        ...healthySafeToSpend,
        safeToSpendCents: -eur(100),
      },
      suppliers: [],
      obligations: [],
    });
    expect(alerts.some((a) => a.id === "safe-to-spend-exhausted")).toBe(true);
    expect(
      alerts.find((a) => a.id === "safe-to-spend-exhausted")?.severity,
    ).toBe("critical");
  });

  it("warns when the forecast dips below the reserve", () => {
    const alerts = computeAlerts({
      safeToSpend: {
        balanceCents: eur(10_000),
        obligationsNext30DaysCents: eur(8_000),
        minimumReserveCents: eur(3_000),
        committedProposalsCents: eur(0),
        safeToSpendCents: -eur(1_000),
      },
      suppliers: [],
      obligations: [],
    });
    expect(alerts.some((a) => a.id === "forecast-below-reserve")).toBe(true);
  });

  it("warns as a supplier approaches its monthly cap", () => {
    const alerts = computeAlerts({
      safeToSpend: healthySafeToSpend,
      suppliers: [{ ...abcCoffee, spentThisMonthCents: eur(6_800) }],
      obligations: [],
    });
    expect(alerts.some((a) => a.id === "supplier-near-abc-coffee")).toBe(true);
  });

  it("marks a supplier at its cap as critical", () => {
    const alerts = computeAlerts({
      safeToSpend: healthySafeToSpend,
      suppliers: [{ ...abcCoffee, spentThisMonthCents: eur(8_000) }],
      obligations: [],
    });
    const alert = alerts.find((a) => a.id === "supplier-over-abc-coffee");
    expect(alert?.severity).toBe("critical");
  });

  it("surfaces imminent obligations only within the window", () => {
    const alerts = computeAlerts({
      safeToSpend: healthySafeToSpend,
      suppliers: [],
      obligations: [
        {
          obligation: {
            id: "ob-rent",
            name: "Premises rent",
            category: "Rent",
            amountCents: eur(2_800),
            dueDate: "2026-10-01",
          },
          daysUntilDue: 1,
        },
        {
          obligation: {
            id: "ob-wages",
            name: "Staff wages",
            category: "Wages",
            amountCents: eur(3_600),
            dueDate: "2026-10-28",
          },
          daysUntilDue: 28,
        },
      ],
    });
    expect(alerts.some((a) => a.id === "obligation-due-ob-rent")).toBe(true);
    expect(alerts.some((a) => a.id === "obligation-due-ob-wages")).toBe(false);
  });
});
