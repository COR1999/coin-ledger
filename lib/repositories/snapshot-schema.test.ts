import { describe, expect, it } from "vitest";

import {
  seedActors,
  seedBusiness,
  seedObligations,
  seedPolicies,
  seedSuppliers,
  seedTransactions,
} from "@/lib/data/seed";
import {
  CorruptStoredDataError,
  parseStored,
  waitlistSchema,
  workspaceSnapshotSchema,
} from "./snapshot-schema";

/** What Redis hands back: plain JSON, optional undefined fields dropped. */
function viaJson<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

const demoSnapshot = {
  business: seedBusiness,
  actors: seedActors,
  suppliers: seedSuppliers,
  transactions: seedTransactions,
  policies: seedPolicies,
  obligations: seedObligations,
  proposals: [],
  resetAt: "2026-10-10T00:00:00.000Z",
};

describe("workspaceSnapshotSchema", () => {
  it("accepts the real demo seed after a JSON round trip, unchanged", () => {
    const parsed = parseStored(
      workspaceSnapshotSchema,
      "workspace:demo",
      viaJson(demoSnapshot),
    );
    expect(parsed).toEqual(viaJson(demoSnapshot));
  });

  it("loads a snapshot written before blocked/paused/transparency existed, defaulting them to false", () => {
    const legacy = viaJson(demoSnapshot) as {
      suppliers: Record<string, unknown>[];
      policies: Record<string, unknown>;
      proposals?: unknown;
    };
    for (const supplier of legacy.suppliers) delete supplier.blocked;
    delete legacy.policies.paymentsPaused;
    delete legacy.policies.publicTransparencyEnabled;
    delete legacy.proposals;

    const parsed = parseStored(
      workspaceSnapshotSchema,
      "workspace:old",
      legacy,
    );
    expect(parsed.suppliers.every((s) => s.blocked === false)).toBe(true);
    expect(parsed.policies.paymentsPaused).toBe(false);
    expect(parsed.policies.publicTransparencyEnabled).toBe(false);
    expect(parsed.proposals).toEqual([]);
  });

  it("rejects a snapshot whose balance is missing, naming the key and field", () => {
    const broken = viaJson(demoSnapshot) as {
      business: Record<string, unknown>;
    };
    delete broken.business.currentBalanceCents;

    expect(() =>
      parseStored(workspaceSnapshotSchema, "workspace:ws-1", broken),
    ).toThrow(CorruptStoredDataError);
    expect(() =>
      parseStored(workspaceSnapshotSchema, "workspace:ws-1", broken),
    ).toThrow(/workspace:ws-1.*business\.currentBalanceCents/);
  });

  it("rejects fractional cents, which would break integer money math", () => {
    const broken = viaJson(demoSnapshot) as {
      business: Record<string, unknown>;
    };
    broken.business.currentBalanceCents = 100.5;
    expect(() =>
      parseStored(workspaceSnapshotSchema, "workspace:ws-1", broken),
    ).toThrow(CorruptStoredDataError);
  });

  it("rejects an unknown proposal status", () => {
    const broken = viaJson({
      ...demoSnapshot,
      proposals: [
        {
          id: "proposal-1",
          supplierId: "abc-coffee",
          amountCents: 100,
          currency: "EUR",
          reason: "x",
          proposedByActorId: "liam",
          status: "paid",
          createdAt: "2026-10-10T00:00:00.000Z",
          policyDecision: "allowed",
          requiresConfirmation: false,
          attempts: 0,
        },
      ],
    });
    expect(() =>
      parseStored(workspaceSnapshotSchema, "workspace:ws-1", broken),
    ).toThrow(/proposals\.0\.status/);
  });
});

describe("waitlistSchema", () => {
  it("accepts stored signups and rejects a malformed one", () => {
    const signup = {
      id: "1",
      name: "Ana",
      email: "ana@example.com",
      businessType: "Cafe",
      createdAt: "2026-10-10T00:00:00.000Z",
    };
    expect(parseStored(waitlistSchema, "waitlist", [signup])).toEqual([signup]);
    expect(() =>
      parseStored(waitlistSchema, "waitlist", [{ ...signup, email: 5 }]),
    ).toThrow(CorruptStoredDataError);
  });
});
