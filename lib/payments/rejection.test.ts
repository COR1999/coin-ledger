import { describe, expect, it } from "vitest";
import { seedPolicies } from "@/lib/data/seed";
import type { ProposalStatus } from "@/lib/domain/types";
import { eur } from "@/lib/money";
import { evaluateRejection } from "./rejection";

function check(
  actorRole: "owner" | "accountant" | "employee",
  status: ProposalStatus,
  amountCents = eur(150),
) {
  return evaluateRejection({
    actorRole,
    proposal: { status, amountCents },
    policies: seedPolicies,
  });
}

describe("evaluateRejection", () => {
  it.each<ProposalStatus>(["pending", "awaiting_confirmation", "failed"])(
    "lets an owner reject a %s proposal",
    (status) => {
      expect(check("owner", status).permitted).toBe(true);
    },
  );

  it.each<ProposalStatus>([
    "approved",
    "confirmed",
    "executing",
    "executed",
    "rejected",
  ])("refuses to reject a %s proposal, even for the owner", (status) => {
    const result = check("owner", status);
    expect(result.permitted).toBe(false);
    expect(result.reasons[0]).toContain(status);
  });

  it("refuses an employee, who has no approval authority", () => {
    expect(check("employee", "pending").permitted).toBe(false);
  });

  it("refuses an accountant for an amount above their approval limit", () => {
    expect(check("accountant", "pending", eur(2_500)).permitted).toBe(false);
  });

  it("lets an accountant reject within their approval limit", () => {
    expect(check("accountant", "pending", eur(1_500)).permitted).toBe(true);
  });
});
