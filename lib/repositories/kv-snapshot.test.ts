import { describe, expect, it } from "vitest";

import { eur } from "@/lib/money";
import type { RepositorySeedData } from "./in-memory";
import {
  KvRepositories,
  kvWorkspaceExists,
  registerKvWorkspace,
  type KvClient,
} from "./kv-snapshot";

/** In-memory stand-in for Redis — no network, same Map-backed shape as the
 * real @upstash/redis client's get/set. */
function fakeKvClient(): KvClient {
  const store = new Map<string, unknown>();
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
      return "OK";
    },
  };
}

function seedData(
  overrides: Partial<RepositorySeedData> = {},
): () => RepositorySeedData {
  return () => ({
    business: {
      id: "ws-test",
      name: "Riverside Bakery",
      currency: "EUR",
      currentBalanceCents: eur(5_000),
    },
    actors: [{ id: "owner", name: "Sam", role: "owner" }],
    suppliers: [
      {
        id: "supplier-1",
        name: "City Flour Co.",
        category: "Ingredients",
        employeeApproved: true,
        monthlyLimitCents: null,
        spentThisMonthCents: 0,
        walletAddress: "0xdemo",
      },
    ],
    transactions: [],
    policies: {
      roles: {
        owner: {
          maxSinglePaymentCents: eur(3_000),
          dailyLimitCents: null,
          approvalLimitCents: eur(3_000),
          restrictedToApprovedSuppliers: false,
          canEditPolicies: true,
        },
        accountant: {
          maxSinglePaymentCents: eur(2_000),
          dailyLimitCents: eur(5_000),
          approvalLimitCents: eur(2_000),
          restrictedToApprovedSuppliers: false,
          canEditPolicies: false,
        },
        employee: {
          maxSinglePaymentCents: eur(100),
          dailyLimitCents: eur(300),
          approvalLimitCents: null,
          restrictedToApprovedSuppliers: true,
          canEditPolicies: false,
        },
      },
      businessDailyLimitCents: eur(10_000),
      minimumReserveCents: eur(500),
      confirmationThresholdCents: eur(1_000),
    },
    obligations: [],
    ...overrides,
  });
}

describe("KvRepositories", () => {
  it("seeds from seedIfMissing when the workspace has never been saved", async () => {
    const client = fakeKvClient();
    const repos = new KvRepositories(client, "ws-test", seedData());

    const business = await repos.business.get();
    expect(business.name).toBe("Riverside Bakery");
  });

  it("persists a mutation so a fresh instance (simulating a new serverless cold start) sees it", async () => {
    const client = fakeKvClient();
    const first = new KvRepositories(client, "ws-test", seedData());
    await first.business.setBalanceCents(eur(1_234));

    // A brand-new instance, same client + workspace id, no shared in-process
    // state with `first` — this is the actual bug being fixed: the old
    // globalThis Map wouldn't survive this on a second serverless instance.
    const second = new KvRepositories(client, "ws-test", seedData());
    const business = await second.business.get();
    expect(business.currentBalanceCents).toBe(eur(1_234));
  });

  it("isolates two different workspaces on the same underlying client", async () => {
    const client = fakeKvClient();
    const a = new KvRepositories(
      client,
      "ws-a",
      seedData({
        business: {
          id: "ws-a",
          name: "Workspace A",
          currency: "EUR",
          currentBalanceCents: eur(1_000),
        },
      }),
    );
    const b = new KvRepositories(
      client,
      "ws-b",
      seedData({
        business: {
          id: "ws-b",
          name: "Workspace B",
          currency: "EUR",
          currentBalanceCents: eur(2_000),
        },
      }),
    );

    await a.business.setBalanceCents(eur(999));

    expect((await a.business.get()).name).toBe("Workspace A");
    expect((await a.business.get()).currentBalanceCents).toBe(eur(999));
    expect((await b.business.get()).name).toBe("Workspace B");
    expect((await b.business.get()).currentBalanceCents).toBe(eur(2_000));
  });

  it("a created proposal keeps its id and is retrievable from a fresh instance", async () => {
    const client = fakeKvClient();
    const first = new KvRepositories(client, "ws-test", seedData());

    const created = await first.proposals.create({
      supplierId: "supplier-1",
      amountCents: eur(50),
      currency: "EUR",
      reason: "Flour",
      proposedByActorId: "owner",
      policyDecision: "allowed",
      requiresConfirmation: false,
      status: "approved",
    });

    const second = new KvRepositories(client, "ws-test", seedData());
    const fetched = await second.proposals.getById(created.id);
    expect(fetched?.amountCents).toBe(eur(50));
    expect(fetched?.reason).toBe("Flour");

    // A second create() on a fresh instance must not collide with the first
    // proposal's id — the sequence counter has to be rehydrated from the
    // snapshot, not reset to 0 (see proposalSequenceNumber in in-memory.ts).
    const secondCreated = await second.proposals.create({
      supplierId: "supplier-1",
      amountCents: eur(10),
      currency: "EUR",
      reason: "More flour",
      proposedByActorId: "owner",
      policyDecision: "allowed",
      requiresConfirmation: false,
      status: "approved",
    });
    expect(secondCreated.id).not.toBe(created.id);

    const all = await second.proposals.list();
    expect(all).toHaveLength(2);
  });

  it("does not lose an update when two operations on the same workspace run concurrently", async () => {
    const client = fakeKvClient();
    const repos = new KvRepositories(client, "ws-test", seedData());

    // Both start from the same balance; without the per-workspace mutex,
    // whichever read-modify-write finishes last would silently discard the
    // other's delta (classic lost update on a whole-blob read-modify-write).
    await Promise.all([
      repos.business.adjustBalanceCents(eur(10)),
      repos.business.adjustBalanceCents(eur(20)),
    ]);

    const business = await repos.business.get();
    expect(business.currentBalanceCents).toBe(eur(5_000) + eur(10) + eur(20));
  });

  it("falls back to the stored transactions/proposals arrays, not just business", async () => {
    const client = fakeKvClient();
    const repos = new KvRepositories(client, "ws-test", seedData());

    await repos.transactions.add({
      id: "tx-1",
      date: "2026-10-05",
      createdAt: "2026-10-05T00:00:00.000Z",
      description: "Flour delivery",
      category: "Supplier",
      amountCents: -eur(50),
      supplierId: "supplier-1",
    });

    const fresh = new KvRepositories(client, "ws-test", seedData());
    const transactions = await fresh.transactions.list();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].description).toBe("Flour delivery");
  });
});

describe("kvWorkspaceExists / registerKvWorkspace", () => {
  it("reports false until a workspace is registered, then true", async () => {
    const client = fakeKvClient();
    expect(await kvWorkspaceExists(client, "ws-new")).toBe(false);

    await registerKvWorkspace(client, "ws-new", seedData()());

    expect(await kvWorkspaceExists(client, "ws-new")).toBe(true);
    const repos = new KvRepositories(client, "ws-new", seedData());
    expect((await repos.business.get()).name).toBe("Riverside Bakery");
  });
});
