import { describe, expect, it, beforeEach } from "vitest";
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
    expect(execTx!.amountCents).toBe(-eur(50));
  });
});
