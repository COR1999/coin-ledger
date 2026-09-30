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
});
