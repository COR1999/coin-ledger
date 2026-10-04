import { describe, expect, it } from "vitest";

import { eur } from "@/lib/money";
import { createInMemoryRepositories } from "./in-memory";

describe("in-memory repositories", () => {
  it("seeds the business and does not leak mutations back into the seed", async () => {
    const a = createInMemoryRepositories();
    const b = createInMemoryRepositories();

    const business = await a.business.get();
    expect(business.name).toBe("Mario's Coffee");
    expect(business.currentBalanceCents).toBe(eur(18_420));

    await a.business.setBalanceCents(eur(1_000));
    // A second, independent store is unaffected.
    expect((await b.business.get()).currentBalanceCents).toBe(eur(18_420));
    expect((await a.business.get()).currentBalanceCents).toBe(eur(1_000));
  });

  it("applies a balance delta relative to the current value, not a stale read", async () => {
    const repos = createInMemoryRepositories();
    await repos.business.adjustBalanceCents(-eur(50));
    expect((await repos.business.get()).currentBalanceCents).toBe(
      eur(18_420) - eur(50),
    );
    await repos.business.adjustBalanceCents(-eur(30));
    expect((await repos.business.get()).currentBalanceCents).toBe(
      eur(18_420) - eur(50) - eur(30),
    );
  });

  it("does not record a second ledger entry for a transaction id that already exists", async () => {
    const repos = createInMemoryRepositories();
    const transaction = {
      id: "tx-dup-test",
      date: "2026-09-30",
      createdAt: "2026-09-30T10:00:00.000Z",
      description: "First add",
      category: "Supplier",
      amountCents: -eur(50),
    };
    await repos.transactions.add(transaction);
    await repos.transactions.add({
      ...transaction,
      description: "Second add with the same id",
    });

    const matches = (await repos.transactions.list()).filter(
      (t) => t.id === "tx-dup-test",
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].description).toBe("First add");
  });

  it("resolves suppliers by id and returns null for unknown ids", async () => {
    const repos = createInMemoryRepositories();
    expect((await repos.suppliers.getById("abc-coffee"))?.name).toBe(
      "ABC Coffee",
    );
    expect(await repos.suppliers.getById("nope")).toBeNull();
  });

  it("creates pending proposals and updates their status", async () => {
    const repos = createInMemoryRepositories();
    const proposal = await repos.proposals.create({
      supplierId: "abc-coffee",
      amountCents: eur(2_400),
      currency: "EUR",
      reason: "Supplier payment",
      proposedByActorId: "liam",
      policyDecision: "needs_approval",
      requiresConfirmation: true,
      status: "pending",
    });
    expect(proposal.status).toBe("pending");

    const approved = await repos.proposals.setStatus(proposal.id, "approved");
    expect(approved.status).toBe("approved");
    expect((await repos.proposals.getById(proposal.id))?.status).toBe(
      "approved",
    );
  });

  it("sums money out for a given date", async () => {
    const repos = createInMemoryRepositories();
    // Seed has two outgoing transactions dated 2026-09-29 (€1,200 to ABC Coffee).
    expect(await repos.transactions.spentOnDateCents("2026-09-29")).toBe(
      eur(1_200),
    );
  });

  it("sums money out for a given date, scoped to one actor", async () => {
    const repos = createInMemoryRepositories();
    await repos.transactions.add({
      id: "tx-test-liam",
      date: "2026-09-30",
      createdAt: "2026-09-30T10:00:00.000Z",
      description: "Liam's payment",
      category: "Supplier",
      amountCents: -eur(50),
      proposedByActorId: "liam",
    });
    await repos.transactions.add({
      id: "tx-test-mario",
      date: "2026-09-30",
      createdAt: "2026-09-30T11:00:00.000Z",
      description: "Mario's payment",
      category: "Supplier",
      amountCents: -eur(30),
      proposedByActorId: "mario",
    });

    expect(
      await repos.transactions.spentOnDateByActorCents("2026-09-30", "liam"),
    ).toBe(eur(50));
    expect(
      await repos.transactions.spentOnDateByActorCents("2026-09-30", "mario"),
    ).toBe(eur(30));
    expect(
      await repos.transactions.spentOnDateByActorCents("2026-09-30", "aoife"),
    ).toBe(0);
  });
});
