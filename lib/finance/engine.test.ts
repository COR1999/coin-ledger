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
  committedProposalsCents,
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

describe("committedProposalsCents", () => {
  const proposals = [
    { id: "p1", status: "pending", amountCents: eur(100) },
    { id: "p2", status: "approved", amountCents: eur(200) },
    { id: "p3", status: "executed", amountCents: eur(300) },
    { id: "p4", status: "rejected", amountCents: eur(400) },
    { id: "p5", status: "failed", amountCents: eur(500) },
  ] as const;

  it("sums only in-flight statuses, excluding settled, rejected and failed ones", () => {
    expect(committedProposalsCents(proposals)).toBe(eur(300)); // p1 + p2
  });

  it("excludes the given proposal id from the sum", () => {
    expect(committedProposalsCents(proposals, "p1")).toBe(eur(200));
  });
});

describe("safeToSpendCents — committed proposals", () => {
  it("subtracts committedProposalsCents from the formula", () => {
    const safe = safeToSpendCents({
      balanceCents: eur(18_420),
      obligationsNext30DaysCents: eur(9_730),
      minimumReserveCents: eur(3_000),
      committedProposalsCents: eur(1_000),
    });
    expect(safe).toBe(eur(4_690));
  });

  it("defaults committedProposalsCents to 0 when omitted", () => {
    const safe = safeToSpendCents({
      balanceCents: eur(18_420),
      obligationsNext30DaysCents: eur(9_730),
      minimumReserveCents: eur(3_000),
    });
    expect(safe).toBe(eur(5_690));
  });
});

describe("netCashFlowCents", () => {
  it("sums signed transaction amounts", () => {
    expect(netCashFlowCents(seedTransactions)).toBe(
      seedTransactions.reduce((s, t) => s + t.amountCents, 0),
    );
  });
});
