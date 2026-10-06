import { describe, expect, it } from "vitest";

import {
  computeDecisionHash,
  type DecisionReceiptInput,
} from "./decision-receipt";

const BASE: DecisionReceiptInput = {
  proposalId: "proposal-1",
  supplierId: "local-veg",
  amountCents: 3_000,
  actorId: "liam",
  decision: "allowed",
  minimumReserveCents: 300_000,
  businessDailyLimitCents: 1_000_000,
  confirmationThresholdCents: 100_000,
  decidedAt: "2026-09-30T12:00:00.000Z",
};

describe("computeDecisionHash", () => {
  it("is deterministic for identical input", () => {
    expect(computeDecisionHash(BASE)).toBe(computeDecisionHash({ ...BASE }));
  });

  it("is a 64-character hex SHA-256 digest", () => {
    const hash = computeDecisionHash(BASE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes if the amount changes", () => {
    expect(computeDecisionHash(BASE)).not.toBe(
      computeDecisionHash({ ...BASE, amountCents: 3_001 }),
    );
  });

  it("changes if the decision changes", () => {
    expect(computeDecisionHash(BASE)).not.toBe(
      computeDecisionHash({ ...BASE, decision: "needs_approval" }),
    );
  });

  it("changes if the policy limits in force at decision time change", () => {
    expect(computeDecisionHash(BASE)).not.toBe(
      computeDecisionHash({ ...BASE, minimumReserveCents: 300_001 }),
    );
  });

  it("changes if the timestamp changes — two otherwise-identical decisions are distinguishable", () => {
    expect(computeDecisionHash(BASE)).not.toBe(
      computeDecisionHash({ ...BASE, decidedAt: "2026-09-30T12:00:01.000Z" }),
    );
  });
});
