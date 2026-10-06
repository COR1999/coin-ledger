import { describe, expect, it } from "vitest";

import type { Actor } from "@/lib/domain/types";
import { createInMemoryRepositories } from "@/lib/repositories/in-memory";
import type { Repositories } from "@/lib/repositories/types";
import { executeTool } from "./tools";

const LIAM: Actor = { id: "liam", name: "Liam", role: "employee" };
const MARIO: Actor = { id: "mario", name: "Mario", role: "owner" };

describe("executeTool: proposePayment", () => {
  it("creates a proposal normally when payments are not paused", async () => {
    const repos: Repositories = createInMemoryRepositories();

    const raw = await executeTool(
      "proposePayment",
      {
        supplierId: "local-veg",
        amount: "30.00",
        currency: "EUR",
        reason: "Potatoes",
      },
      repos,
      LIAM,
    );
    const result = JSON.parse(raw);

    expect(result.created).toBe(true);
    expect(result.decision).toBe("allowed");
  });

  it("refuses to create a proposal while payments are paused, with a clear reason", async () => {
    const repos: Repositories = createInMemoryRepositories();
    const policies = await repos.policies.get();
    await repos.policies.set({ ...policies, paymentsPaused: true });

    const raw = await executeTool(
      "proposePayment",
      {
        supplierId: "local-veg",
        amount: "30.00",
        currency: "EUR",
        reason: "Potatoes",
      },
      repos,
      LIAM,
    );
    const result = JSON.parse(raw);

    expect(result.created).toBe(false);
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/paused/i);

    // The whole point of this check: no proposal should exist to be
    // discovered later, half-created, once payments resume.
    expect(await repos.proposals.list()).toHaveLength(0);
  });

  it("refuses to propose a payment to a blocked supplier, even for the owner", async () => {
    const repos: Repositories = createInMemoryRepositories();
    await repos.suppliers.update("local-veg", { blocked: true });

    const raw = await executeTool(
      "proposePayment",
      {
        supplierId: "local-veg",
        amount: "30.00",
        currency: "EUR",
        reason: "Potatoes",
      },
      repos,
      MARIO,
    );
    const result = JSON.parse(raw);

    expect(result.created).toBe(false);
    expect(result.decision).toBe("rejected");
    expect(result.reasons.join(" ")).toMatch(/blocked/i);
    expect(await repos.proposals.list()).toHaveLength(0);
  });
});
