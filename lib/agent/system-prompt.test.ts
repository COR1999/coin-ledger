import { describe, expect, it } from "vitest";

import type { Actor } from "@/lib/domain/types";
import { eur } from "@/lib/money";
import { buildSystemPrompt, type SystemPromptPolicies } from "./system-prompt";

const ACTOR: Actor = { id: "owner", name: "Sam", role: "owner" };

const POLICIES: SystemPromptPolicies = {
  roles: {
    owner: {
      maxSinglePaymentCents: eur(3_000),
      dailyLimitCents: null,
      approvalLimitCents: eur(3_000),
    },
  },
  confirmationThresholdCents: eur(1_000),
  minimumReserveCents: eur(500),
  businessDailyLimitCents: eur(10_000),
};

describe("buildSystemPrompt", () => {
  it("names the actual business, not a hardcoded demo name", () => {
    const prompt = buildSystemPrompt(ACTOR, "Riverside Bakery", [], POLICIES);
    expect(prompt).toContain("Riverside Bakery");
    expect(prompt).not.toContain("Mario's Coffee");
  });

  it("lists the workspace's own suppliers by name and id, not the demo's", () => {
    const prompt = buildSystemPrompt(
      ACTOR,
      "Riverside Bakery",
      [{ id: "supplier-1", name: "City Flour Co." }],
      POLICIES,
    );
    expect(prompt).toContain("City Flour Co. (supplier-1)");
    // The exact regression a real user hit live: an onboarded workspace's
    // agent describing the demo business's suppliers instead of its own.
    expect(prompt).not.toContain("ABC Coffee");
    expect(prompt).not.toContain("abc-coffee");
    expect(prompt).not.toContain("Local Veg Supplier");
    expect(prompt).not.toContain("local-veg");
    expect(prompt).not.toContain("Unknown Vendor Ltd");
  });

  it("says plainly when a workspace has no suppliers yet, rather than inventing any", () => {
    const prompt = buildSystemPrompt(ACTOR, "Riverside Bakery", [], POLICIES);
    expect(prompt).toContain("none on file yet");
  });

  it("lists every supplier when there's more than one", () => {
    const prompt = buildSystemPrompt(
      ACTOR,
      "Riverside Bakery",
      [
        { id: "supplier-1", name: "City Flour Co." },
        { id: "supplier-2", name: "Dairy Co-op" },
      ],
      POLICIES,
    );
    expect(prompt).toContain("City Flour Co. (supplier-1)");
    expect(prompt).toContain("Dairy Co-op (supplier-2)");
  });
});
