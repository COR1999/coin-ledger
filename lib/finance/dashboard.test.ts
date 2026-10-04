import { describe, expect, it } from "vitest";

import {
  seedBusiness,
  seedObligations,
  seedPolicies,
  seedTransactions,
  SEED_TODAY,
} from "@/lib/data/seed";
import { eur } from "@/lib/money";
import {
  buildDashboardData,
  forecastSeries,
  recentTransactions,
  safeToSpendBreakdown,
  upcomingObligations,
} from "./dashboard";

describe("safeToSpendBreakdown", () => {
  it("reports the documented figure and its components", () => {
    const b = safeToSpendBreakdown(
      seedBusiness,
      seedObligations,
      [],
      seedPolicies,
      SEED_TODAY,
    );
    expect(b.balanceCents).toBe(eur(18_420));
    expect(b.obligationsNext30DaysCents).toBe(eur(9_730));
    expect(b.minimumReserveCents).toBe(eur(3_000));
    expect(b.committedProposalsCents).toBe(eur(0));
    expect(b.safeToSpendCents).toBe(eur(5_690));
  });

  it("subtracts other in-flight proposals from safe-to-spend", () => {
    const b = safeToSpendBreakdown(
      seedBusiness,
      seedObligations,
      [{ id: "p1", status: "approved", amountCents: eur(1_000) }],
      seedPolicies,
      SEED_TODAY,
    );
    expect(b.committedProposalsCents).toBe(eur(1_000));
    expect(b.safeToSpendCents).toBe(eur(4_690));
  });
});

describe("upcomingObligations", () => {
  it("returns future obligations soonest-first with days-until-due", () => {
    const list = upcomingObligations(seedObligations, SEED_TODAY, 30);
    expect(list).toHaveLength(seedObligations.length);
    expect(list[0].id).toBe("ob-rent"); // due 2026-10-01, one day out
    expect(list[0].daysUntilDue).toBe(1);
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i].daysUntilDue).toBeGreaterThanOrEqual(
        list[i - 1].daysUntilDue,
      );
    }
  });

  it("excludes obligations beyond the horizon", () => {
    const list = upcomingObligations(seedObligations, SEED_TODAY, 5);
    expect(list.every((o) => o.daysUntilDue <= 5)).toBe(true);
    expect(list.map((o) => o.id)).toContain("ob-rent");
    expect(list.map((o) => o.id)).toContain("ob-software");
  });
});

describe("forecastSeries", () => {
  it("has one point per day inclusive of both ends", () => {
    const s = forecastSeries(seedBusiness, seedObligations, SEED_TODAY, 30);
    expect(s).toHaveLength(31);
  });

  it("starts at the balance and lands on the 30-day forecast", () => {
    const s = forecastSeries(seedBusiness, seedObligations, SEED_TODAY, 30);
    expect(s[0].balanceCents).toBe(eur(18_420));
    expect(s[s.length - 1].balanceCents).toBe(eur(8_690)); // 18,420 - 9,730
  });

  it("never increases (no revenue assumed)", () => {
    const s = forecastSeries(seedBusiness, seedObligations, SEED_TODAY, 30);
    for (let i = 1; i < s.length; i += 1) {
      expect(s[i].balanceCents).toBeLessThanOrEqual(s[i - 1].balanceCents);
    }
  });
});

describe("recentTransactions", () => {
  it("returns newest first, capped at the limit", () => {
    const rows = recentTransactions(seedTransactions, 3);
    expect(rows).toHaveLength(3);
    expect(rows[0].date >= rows[1].date).toBe(true);
    expect(rows[1].date >= rows[2].date).toBe(true);
  });

  it("orders same-date transactions by createdAt, not array position", () => {
    const sameDayEarlier = {
      id: "tx-early",
      date: "2026-09-30",
      createdAt: "2026-09-30T09:00:00.000Z",
      description: "Earlier",
      category: "Supplier",
      amountCents: -eur(10),
    };
    const sameDayLater = {
      id: "tx-later",
      date: "2026-09-30",
      createdAt: "2026-09-30T15:00:00.000Z",
      description: "Later",
      category: "Supplier",
      amountCents: -eur(20),
    };
    // Deliberately inserted with the later transaction first, to prove the
    // sort uses createdAt rather than falling back to array order.
    const rows = recentTransactions([sameDayLater, sameDayEarlier], 2);
    expect(rows[0].id).toBe("tx-later");
    expect(rows[1].id).toBe("tx-early");
  });
});

describe("buildDashboardData", () => {
  it("assembles a consistent snapshot", () => {
    const data = buildDashboardData({
      business: seedBusiness,
      obligations: seedObligations,
      proposals: [],
      transactions: seedTransactions,
      policies: seedPolicies,
      asOf: SEED_TODAY,
    });
    expect(data.safeToSpend.safeToSpendCents).toBe(eur(5_690));
    expect(data.forecast.projectedBalanceCents).toBe(eur(8_690));
    expect(data.forecastSeries[0].balanceCents).toBe(eur(18_420));
    expect(data.transactions.length).toBeLessThanOrEqual(12);
  });
});
