import { describe, expect, it } from "vitest";

import {
  seedBusiness,
  seedObligations,
  seedTransactions,
  SEED_TODAY,
} from "@/lib/data/seed";
import type { Obligation } from "@/lib/domain/types";
import { eur } from "@/lib/money";
import {
  forecast30Day,
  netCashFlowCents,
  projectedBalanceAfterCents,
  safeToSpendCents,
  upcomingObligationsCents,
} from "./engine";

describe("finance engine — seed figures", () => {
  it("sums obligations due in the next 30 days to €9,730", () => {
    expect(upcomingObligationsCents(seedObligations, SEED_TODAY)).toBe(
      eur(9_730),
    );
  });

  it("computes safe-to-spend of €5,690 from the seed", () => {
    const obligations = upcomingObligationsCents(seedObligations, SEED_TODAY);
    const safe = safeToSpendCents({
      balanceCents: seedBusiness.currentBalanceCents,
      obligationsNext30DaysCents: obligations,
      minimumReserveCents: eur(3_000),
    });
    expect(safe).toBe(eur(5_690));
  });

  it("projects the balance after a proposed payment", () => {
    expect(
      projectedBalanceAfterCents(seedBusiness.currentBalanceCents, eur(2_400)),
    ).toBe(eur(16_020));
  });

  it("forecasts the 30-day balance floor (balance − obligations)", () => {
    const forecast = forecast30Day(seedBusiness, seedObligations, SEED_TODAY);
    expect(forecast.startingBalanceCents).toBe(eur(18_420));
    expect(forecast.totalObligationsCents).toBe(eur(9_730));
    expect(forecast.projectedBalanceCents).toBe(eur(8_690));
  });
});

describe("upcomingObligationsCents — horizon boundaries", () => {
  const obligations: Obligation[] = [
    {
      id: "past",
      name: "Past due",
      category: "x",
      amountCents: eur(100),
      dueDate: "2026-09-01",
    },
    {
      id: "today",
      name: "Due today",
      category: "x",
      amountCents: eur(200),
      dueDate: SEED_TODAY,
    },
    {
      id: "edge",
      name: "Day 30",
      category: "x",
      amountCents: eur(400),
      dueDate: "2026-10-30",
    },
    {
      id: "beyond",
      name: "Day 31",
      category: "x",
      amountCents: eur(800),
      dueDate: "2026-10-31",
    },
  ];

  it("includes today and the 30-day edge, excludes past-due and beyond-horizon", () => {
    expect(upcomingObligationsCents(obligations, SEED_TODAY, 30)).toBe(
      eur(600),
    );
  });
});

describe("netCashFlowCents", () => {
  it("sums signed transaction amounts", () => {
    expect(netCashFlowCents(seedTransactions)).toBe(
      seedTransactions.reduce((s, t) => s + t.amountCents, 0),
    );
  });
});
