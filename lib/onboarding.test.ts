import { describe, expect, it } from "vitest";

import { getRepositories } from "@/lib/repositories/workspace-store";
import { createWorkspace, onboardingInputSchema } from "./onboarding";

const VALID_INPUT = {
  businessName: "Riverside Bakery",
  ownerName: "Sam",
  suppliers: [{ name: "City Flour Co.", category: "Ingredients" }],
};

describe("onboardingInputSchema", () => {
  it("accepts valid input", () => {
    expect(onboardingInputSchema.safeParse(VALID_INPUT).success).toBe(true);
  });

  it("rejects a blank business name", () => {
    const result = onboardingInputSchema.safeParse({
      ...VALID_INPUT,
      businessName: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero suppliers", () => {
    const result = onboardingInputSchema.safeParse({
      ...VALID_INPUT,
      suppliers: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than three suppliers", () => {
    const result = onboardingInputSchema.safeParse({
      ...VALID_INPUT,
      suppliers: Array.from({ length: 4 }, (_, i) => ({
        name: `Supplier ${i}`,
        category: "Misc",
      })),
    });
    expect(result.success).toBe(false);
  });
});

describe("createWorkspace", () => {
  it("builds a workspace from the visitor's own data, with a walletAddress on every supplier", async () => {
    const workspaceId = await createWorkspace(VALID_INPUT);
    const repos = getRepositories(workspaceId);

    const [business, actors, suppliers, transactions, obligations] =
      await Promise.all([
        repos.business.get(),
        repos.actors.list(),
        repos.suppliers.list(),
        repos.transactions.list(),
        repos.obligations.list(),
      ]);

    expect(business.name).toBe("Riverside Bakery");
    expect(actors.find((a) => a.role === "owner")?.name).toBe("Sam");
    expect(suppliers).toHaveLength(1);
    expect(suppliers[0].name).toBe("City Flour Co.");
    // Required by lib/payments/execute.ts before any payment can execute —
    // without this, every payment attempt in a fresh workspace would fail
    // with MISSING_WALLET_ADDRESS.
    expect(suppliers[0].walletAddress).toBeTruthy();
    // No bills inherited from Mario's Coffee — a fresh business starts clean.
    expect(transactions).toHaveLength(0);
    expect(obligations).toHaveLength(0);
  });

  it("isolates two workspaces from each other", async () => {
    const idA = await createWorkspace({
      ...VALID_INPUT,
      businessName: "Workspace A",
    });
    const idB = await createWorkspace({
      ...VALID_INPUT,
      businessName: "Workspace B",
    });

    expect(idA).not.toBe(idB);
    await getRepositories(idA).business.setBalanceCents(1_234);

    const businessA = await getRepositories(idA).business.get();
    const businessB = await getRepositories(idB).business.get();
    expect(businessA.currentBalanceCents).toBe(1_234);
    expect(businessB.currentBalanceCents).not.toBe(1_234);
    expect(businessB.name).toBe("Workspace B");
  });
});
