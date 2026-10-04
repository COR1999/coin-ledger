import { describe, expect, it, beforeEach } from "vitest";
import { SEED_TODAY } from "@/lib/data/seed";
import { createInMemoryRepositories } from "@/lib/repositories/in-memory";
import type { Repositories } from "@/lib/repositories/types";
import type { PaymentProvider, PaymentStatus } from "./types";
import { executePayment, ExecutionError } from "./execute";
import { eur } from "@/lib/money";

function createMockProvider(
  overrides: Partial<{
    submitResult: { paymentId: string; status: "pending" };
    statusResult: PaymentStatus;
  }> = {},
): PaymentProvider {
  return {
    submit: async () =>
      overrides.submitResult ?? { paymentId: "pay-1", status: "pending" },
    getStatus: async () =>
      overrides.statusResult ?? {
        status: "confirmed",
        txHash: "0xabc",
      },
  };
}

async function createApprovedProposal(
  repos: Repositories,
  overrides: Partial<{
    supplierId: string;
    amountCents: number;
    proposedByActorId: string;
    requiresConfirmation: boolean;
    status: string;
    approvedByActorId: string;
    confirmedByActorId: string;
    policyDecision: string;
  }> = {},
) {
  const proposal = await repos.proposals.create({
    supplierId: overrides.supplierId ?? "local-veg",
    amountCents: overrides.amountCents ?? eur(30),
    currency: "EUR",
    reason: "Test payment",
    proposedByActorId: overrides.proposedByActorId ?? "liam",
    policyDecision:
      (overrides.policyDecision as "allowed" | "needs_approval" | "rejected") ??
      "allowed",
    requiresConfirmation: overrides.requiresConfirmation ?? false,
    status: (overrides.status as "approved") ?? "approved",
  });

  if (overrides.approvedByActorId) {
    await repos.proposals.update(proposal.id, {
      approvedByActorId: overrides.approvedByActorId,
    });
  }
  if (overrides.confirmedByActorId) {
    await repos.proposals.update(proposal.id, {
      confirmedByActorId: overrides.confirmedByActorId,
    });
  }

  return proposal;
}

describe("executePayment", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories();
  });

  it("executes an approved, within-limits payment", async () => {
    const proposal = await createApprovedProposal(repos);
    const provider = createMockProvider();

    const result = await executePayment(proposal.id, repos, provider, {
      intervalMs: 1,
      maxAttempts: 1,
    });

    expect(result.status).toBe("confirmed");
    expect(result.txHash).toBe("0xabc");

    const updated = await repos.proposals.getById(proposal.id);
    expect(updated!.status).toBe("executed");
    expect(updated!.txHash).toBe("0xabc");

    const business = await repos.business.get();
    expect(business.currentBalanceCents).toBe(eur(18_420) - eur(30));
  });

  it("rejects a proposal that does not exist", async () => {
    const provider = createMockProvider();

    await expect(
      executePayment("nonexistent", repos, provider),
    ).rejects.toThrow(ExecutionError);

    try {
      await executePayment("nonexistent", repos, provider);
    } catch (e) {
      expect((e as ExecutionError).code).toBe("NOT_FOUND");
    }
  });

  it("rejects an already-executed proposal (duplicate)", async () => {
    const proposal = await createApprovedProposal(repos);
    await repos.proposals.update(proposal.id, { status: "executed" });
    const provider = createMockProvider();

    await expect(executePayment(proposal.id, repos, provider)).rejects.toThrow(
      ExecutionError,
    );

    try {
      await executePayment(proposal.id, repos, provider);
    } catch (e) {
      expect((e as ExecutionError).code).toBe("ALREADY_EXECUTED");
    }
  });

  it("rejects a supplier with no on-chain wallet address", async () => {
    const proposal = await createApprovedProposal(repos, {
      supplierId: "unknown-vendor",
      proposedByActorId: "mario",
      amountCents: eur(30),
    });
    const provider = createMockProvider();

    try {
      await executePayment(proposal.id, repos, provider);
      throw new Error("expected executePayment to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ExecutionError);
      expect((e as ExecutionError).code).toBe("MISSING_WALLET_ADDRESS");
    }
  });

  it("rejects a proposal with rejected status", async () => {
    const proposal = await createApprovedProposal(repos);
    await repos.proposals.update(proposal.id, { status: "rejected" });
    const provider = createMockProvider();

    await expect(executePayment(proposal.id, repos, provider)).rejects.toThrow(
      ExecutionError,
    );

    try {
      await executePayment(proposal.id, repos, provider);
    } catch (e) {
      expect((e as ExecutionError).code).toBe("INVALID_STATUS");
    }
  });

  it("rejects when approval is required but missing", async () => {
    const proposal = await createApprovedProposal(repos, {
      policyDecision: "needs_approval",
      amountCents: eur(2_400),
      status: "approved",
    });
    const provider = createMockProvider();

    await expect(executePayment(proposal.id, repos, provider)).rejects.toThrow(
      ExecutionError,
    );

    try {
      await executePayment(proposal.id, repos, provider);
    } catch (e) {
      expect((e as ExecutionError).code).toBe("MISSING_APPROVAL");
    }
  });

  it("rejects when confirmation is required but missing", async () => {
    const proposal = await createApprovedProposal(repos, {
      requiresConfirmation: true,
      amountCents: eur(1_500),
      status: "approved",
    });
    const provider = createMockProvider();

    await expect(executePayment(proposal.id, repos, provider)).rejects.toThrow(
      ExecutionError,
    );

    try {
      await executePayment(proposal.id, repos, provider);
    } catch (e) {
      expect((e as ExecutionError).code).toBe("MISSING_CONFIRMATION");
    }
  });

  it("rejects when approver lacks authority (wrong role)", async () => {
    const proposal = await createApprovedProposal(repos, {
      supplierId: "abc-coffee",
      policyDecision: "needs_approval",
      amountCents: eur(2_400),
      status: "confirmed",
      approvedByActorId: "liam",
      confirmedByActorId: "liam",
      requiresConfirmation: true,
    });
    const provider = createMockProvider();

    await expect(executePayment(proposal.id, repos, provider)).rejects.toThrow(
      ExecutionError,
    );

    try {
      await executePayment(proposal.id, repos, provider);
    } catch (e) {
      expect((e as ExecutionError).code).toBe("INVALID_APPROVER");
    }
  });

  it("handles a failed provider payment", async () => {
    const proposal = await createApprovedProposal(repos);
    const provider = createMockProvider({
      statusResult: {
        status: "failed",
        failureReason: "Insufficient gas",
      },
    });

    const result = await executePayment(proposal.id, repos, provider, {
      intervalMs: 1,
      maxAttempts: 1,
    });

    expect(result.status).toBe("failed");
    expect(result.failureReason).toBe("Insufficient gas");

    const updated = await repos.proposals.getById(proposal.id);
    expect(updated!.status).toBe("failed");

    const business = await repos.business.get();
    expect(business.currentBalanceCents).toBe(eur(18_420));
  });

  it("handles a pending provider payment (gives up after exhausting polls)", async () => {
    const proposal = await createApprovedProposal(repos);
    const provider = createMockProvider({
      statusResult: { status: "pending" },
    });

    const result = await executePayment(proposal.id, repos, provider, {
      intervalMs: 1,
      maxAttempts: 2,
    });

    expect(result.status).toBe("pending");
    expect(result.paymentId).toBe("pay-1");
  });

  it("executes a needs_approval proposal with valid approval and confirmation", async () => {
    const proposal = await createApprovedProposal(repos, {
      supplierId: "abc-coffee",
      policyDecision: "needs_approval",
      amountCents: eur(2_400),
      status: "confirmed",
      approvedByActorId: "mario",
      confirmedByActorId: "mario",
      requiresConfirmation: true,
    });
    const provider = createMockProvider();

    const result = await executePayment(proposal.id, repos, provider, {
      intervalMs: 1,
      maxAttempts: 1,
    });

    expect(result.status).toBe("confirmed");
    expect(result.txHash).toBe("0xabc");
  });

  it("retries a failed proposal with a fresh idempotency key per attempt", async () => {
    const proposal = await createApprovedProposal(repos);
    const submittedKeys: string[] = [];
    const provider: PaymentProvider = {
      submit: async (req) => {
        submittedKeys.push(req.idempotencyKey);
        return { paymentId: `pay-${submittedKeys.length}`, status: "pending" };
      },
      getStatus: async () => ({
        status: "failed",
        failureReason: "Simulated transaction failure",
      }),
    };

    const firstAttempt = await executePayment(proposal.id, repos, provider, {
      intervalMs: 1,
      maxAttempts: 1,
    });
    expect(firstAttempt.status).toBe("failed");
    expect((await repos.proposals.getById(proposal.id))!.status).toBe("failed");

    // Retrying calls executePayment again on the now-"failed" proposal —
    // previously blocked by INVALID_STATUS; retry is the one caller allowed
    // to re-enter execution on a failed proposal.
    const secondAttempt = await executePayment(proposal.id, repos, provider, {
      intervalMs: 1,
      maxAttempts: 1,
    });
    expect(secondAttempt.status).toBe("failed");

    expect(submittedKeys).toHaveLength(2);
    expect(submittedKeys[0]).not.toBe(submittedKeys[1]);

    const updated = await repos.proposals.getById(proposal.id);
    expect(updated!.attempts).toBe(2);
  });

  it("re-checks the actor's real daily spend at execution time (not hardcoded to zero)", async () => {
    // Liam's seed policy: €100 single-payment limit, €300 daily limit.
    // Already spent €270 today via other executed payments.
    await repos.transactions.add({
      id: "tx-prior",
      date: SEED_TODAY,
      createdAt: `${SEED_TODAY}T09:00:00.000Z`,
      description: "Prior payment",
      category: "Supplier",
      amountCents: -eur(270),
      proposedByActorId: "liam",
    });

    // €50 is within Liam's single-payment limit, but €270 + €50 = €320
    // breaches his €300 daily limit — the re-check must catch this even
    // though the proposal itself was created as "allowed".
    const proposal = await createApprovedProposal(repos, {
      amountCents: eur(50),
      proposedByActorId: "liam",
    });
    const provider = createMockProvider();

    try {
      await executePayment(proposal.id, repos, provider);
      throw new Error("expected executePayment to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ExecutionError);
      expect((e as ExecutionError).code).toBe("POLICY_REJECTED");
    }

    const updated = await repos.proposals.getById(proposal.id);
    expect(updated!.status).toBe("rejected");
  });

  it("rejects retrying a rejected proposal", async () => {
    const proposal = await createApprovedProposal(repos);
    await repos.proposals.update(proposal.id, { status: "rejected" });
    const provider = createMockProvider();

    try {
      await executePayment(proposal.id, repos, provider);
      throw new Error("expected executePayment to throw");
    } catch (e) {
      expect((e as ExecutionError).code).toBe("INVALID_STATUS");
    }
  });

  it("rejects execution when another in-flight proposal has already committed the safe-to-spend headroom", async () => {
    // Baseline safe-to-spend: 18,420 - 9,730 - 3,000 = 5,690. A second
    // proposal already committing 5,600 of that (still "approved", not yet
    // executed) leaves only 90 free — not enough for this one's 200.
    const inFlight = await createApprovedProposal(repos, {
      amountCents: eur(5_600),
    });
    const proposal = await createApprovedProposal(repos, {
      amountCents: eur(200),
    });
    const provider = createMockProvider();

    try {
      await executePayment(proposal.id, repos, provider);
      throw new Error("expected executePayment to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ExecutionError);
      expect((e as ExecutionError).code).toBe("POLICY_REJECTED");
    }

    const updated = await repos.proposals.getById(proposal.id);
    expect(updated!.status).toBe("rejected");

    // The other in-flight proposal is untouched by this re-check.
    const untouched = await repos.proposals.getById(inFlight.id);
    expect(untouched!.status).toBe("approved");
  });

  it("deducts from business balance only on confirmed payment", async () => {
    const proposal = await createApprovedProposal(repos, {
      amountCents: eur(50),
    });
    const provider = createMockProvider();

    await executePayment(proposal.id, repos, provider, {
      intervalMs: 1,
      maxAttempts: 1,
    });

    const business = await repos.business.get();
    expect(business.currentBalanceCents).toBe(eur(18_420) - eur(50));

    const txs = await repos.transactions.list();
    const execTx = txs.find((t) => t.id === `tx-exec-${proposal.id}`);
    expect(execTx).toBeDefined();
    expect(execTx!.txHash).toBe("0xabc");
    expect(execTx!.proposalId).toBe(proposal.id);
    expect(execTx!.amountCents).toBe(-eur(50));
  });

  it("applies both deductions when two different proposals execute concurrently (no lost update)", async () => {
    const proposalA = await createApprovedProposal(repos, {
      amountCents: eur(40),
      proposedByActorId: "liam",
    });
    const proposalB = await createApprovedProposal(repos, {
      amountCents: eur(1_000),
      proposedByActorId: "mario",
    });
    const provider = createMockProvider();

    const [resultA, resultB] = await Promise.all([
      executePayment(proposalA.id, repos, provider, {
        intervalMs: 1,
        maxAttempts: 1,
      }),
      executePayment(proposalB.id, repos, provider, {
        intervalMs: 1,
        maxAttempts: 1,
      }),
    ]);

    expect(resultA.status).toBe("confirmed");
    expect(resultB.status).toBe("confirmed");

    const business = await repos.business.get();
    expect(business.currentBalanceCents).toBe(
      eur(18_420) - eur(40) - eur(1_000),
    );
  });

  it("serializes concurrent calls for the same proposal — only one execution happens", async () => {
    const proposal = await createApprovedProposal(repos, {
      amountCents: eur(50),
    });
    const provider = createMockProvider();

    const results = await Promise.allSettled([
      executePayment(proposal.id, repos, provider, {
        intervalMs: 1,
        maxAttempts: 1,
      }),
      executePayment(proposal.id, repos, provider, {
        intervalMs: 1,
        maxAttempts: 1,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ExecutionError,
    );
    expect(
      ((rejected[0] as PromiseRejectedResult).reason as ExecutionError).code,
    ).toBe("ALREADY_EXECUTED");

    const business = await repos.business.get();
    expect(business.currentBalanceCents).toBe(eur(18_420) - eur(50));

    const txs = await repos.transactions.list();
    expect(txs.filter((t) => t.proposalId === proposal.id)).toHaveLength(1);
  });

  it("resumes polling the same payment after a timeout instead of resubmitting", async () => {
    const proposal = await createApprovedProposal(repos, {
      amountCents: eur(50),
    });
    let submitCount = 0;
    let resolved = false;
    const provider: PaymentProvider = {
      submit: async () => {
        submitCount += 1;
        return { paymentId: "pay-resume", status: "pending" };
      },
      getStatus: async () =>
        resolved
          ? { status: "confirmed", txHash: "0xresumed" }
          : { status: "pending" },
    };

    const timedOut = await executePayment(proposal.id, repos, provider, {
      intervalMs: 1,
      maxAttempts: 2,
    });
    expect(timedOut.status).toBe("pending");

    const stuck = await repos.proposals.getById(proposal.id);
    expect(stuck!.status).toBe("executing");
    expect(stuck!.paymentId).toBe("pay-resume");

    resolved = true;
    const resumed = await executePayment(proposal.id, repos, provider, {
      intervalMs: 1,
      maxAttempts: 2,
    });

    expect(resumed.status).toBe("confirmed");
    expect(resumed.txHash).toBe("0xresumed");
    // Never resubmitted — resumed polling the same payment instead of
    // sending a second real payment for an outcome that was merely unknown.
    expect(submitCount).toBe(1);

    const business = await repos.business.get();
    expect(business.currentBalanceCents).toBe(eur(18_420) - eur(50));

    const updated = await repos.proposals.getById(proposal.id);
    expect(updated!.status).toBe("executed");
    expect(updated!.attempts).toBe(1);
  });

  it("leaves the proposal resumable (not falsely failed) when checking status throws", async () => {
    const proposal = await createApprovedProposal(repos, {
      amountCents: eur(50),
    });
    const provider: PaymentProvider = {
      submit: async () => ({ paymentId: "pay-flaky", status: "pending" }),
      getStatus: async () => {
        throw new Error("network blip");
      },
    };

    await expect(
      executePayment(proposal.id, repos, provider, {
        intervalMs: 1,
        maxAttempts: 1,
      }),
    ).rejects.toThrow(ExecutionError);

    const stuck = await repos.proposals.getById(proposal.id);
    expect(stuck!.status).toBe("executing");
    expect(stuck!.paymentId).toBe("pay-flaky");

    const business = await repos.business.get();
    // Outcome unknown — balance must stay untouched, not optimistically
    // deducted or reverted.
    expect(business.currentBalanceCents).toBe(eur(18_420));
  });
});
