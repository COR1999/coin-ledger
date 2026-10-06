import { z } from "zod";
import { SEED_TODAY } from "@/lib/data/seed";
import type { Repositories } from "@/lib/repositories/types";
import {
  committedProposalsCents,
  forecast30Day,
  safeToSpendCents,
  upcomingObligationsCents,
} from "@/lib/finance/engine";
import { evaluatePolicy, type PolicyBusinessState } from "@/lib/policy/engine";
import { formatEuros, parseAmountToCents } from "@/lib/money";
import { proposedPaymentSchema } from "@/lib/domain/types";
import type { Actor } from "@/lib/domain/types";
import { Type, type FunctionDeclaration } from "@google/genai";

const getSupplierSchema = z.object({
  supplierId: z.string().min(1),
});
const checkPolicySchema = z.object({
  supplierId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const toolDefinitions: FunctionDeclaration[] = [
  {
    name: "getBalance",
    description:
      "Get the current cash balance, safe-to-spend amount, and upcoming obligations total for the business.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "getObligations",
    description:
      "List all upcoming financial obligations (bills, wages, rent, etc.) due in the next 30 days with amounts and due dates.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "getForecast",
    description:
      "Get the 30-day cash forecast showing projected balance after all obligations clear (conservative, no new revenue assumed).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "getSupplier",
    description:
      "Look up a supplier by ID. Returns name, monthly limit, spend this month, and whether employees may pay them.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        supplierId: {
          type: Type.STRING,
          description:
            "The supplier's id, exactly as given in the system prompt's known-suppliers list — never guessed or invented.",
        },
      },
      required: ["supplierId"],
    },
  },
  {
    name: "checkPolicy",
    description:
      "Check what the policy engine would decide for a payment of a given amount to a given supplier, without creating a proposal. Returns allowed/needs_approval/rejected and reasons.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        supplierId: {
          type: Type.STRING,
          description: "Supplier ID",
        },
        amount: {
          type: Type.STRING,
          description: 'Decimal amount in EUR, e.g. "2400.00"',
        },
      },
      required: ["supplierId", "amount"],
    },
  },
  {
    name: "proposePayment",
    description:
      "Create a payment proposal for a specific amount to a specific supplier. This does NOT execute the payment — it creates a pending proposal that goes through the approval/confirmation flow. Returns the proposal with its policy decision.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        supplierId: {
          type: Type.STRING,
          description: "Supplier ID",
        },
        amount: {
          type: Type.STRING,
          description: 'Decimal amount in EUR, e.g. "30.00"',
        },
        currency: {
          type: Type.STRING,
          enum: ["EUR"],
        },
        reason: {
          type: Type.STRING,
          description: "Brief reason for the payment",
        },
      },
      required: ["supplierId", "amount", "currency", "reason"],
    },
  },
];

async function buildBusinessState(
  repos: Repositories,
  actorId: string,
): Promise<PolicyBusinessState> {
  const [
    business,
    todaySpentByBusiness,
    todaySpentByActor,
    obligations,
    proposals,
  ] = await Promise.all([
    repos.business.get(),
    repos.transactions.spentOnDateCents(SEED_TODAY),
    repos.transactions.spentOnDateByActorCents(SEED_TODAY, actorId),
    repos.obligations.list(),
    repos.proposals.list(),
  ]);
  const obligationsNext30Days = upcomingObligationsCents(
    obligations,
    SEED_TODAY,
    30,
  );

  return {
    balanceCents: business.currentBalanceCents,
    obligationsNext30DaysCents: obligationsNext30Days,
    todaySpentByActorCents: todaySpentByActor,
    todaySpentByBusinessCents: todaySpentByBusiness,
    committedPendingCents: committedProposalsCents(proposals),
  };
}

export async function executeTool(
  toolName: string,
  rawInput: unknown,
  repos: Repositories,
  actor: Actor,
): Promise<string> {
  switch (toolName) {
    case "getBalance": {
      const [business, policies, obligations, proposals] = await Promise.all([
        repos.business.get(),
        repos.policies.get(),
        repos.obligations.list(),
        repos.proposals.list(),
      ]);
      const obligationsTotal = upcomingObligationsCents(
        obligations,
        SEED_TODAY,
        30,
      );
      const committedPending = committedProposalsCents(proposals);
      const safe = safeToSpendCents({
        balanceCents: business.currentBalanceCents,
        obligationsNext30DaysCents: obligationsTotal,
        minimumReserveCents: policies.minimumReserveCents,
        committedProposalsCents: committedPending,
      });
      return JSON.stringify({
        currentBalance: formatEuros(business.currentBalanceCents),
        obligationsNext30Days: formatEuros(obligationsTotal),
        minimumReserve: formatEuros(policies.minimumReserveCents),
        committedToPendingProposals: formatEuros(committedPending),
        safeToSpend: formatEuros(safe),
        formula:
          "safe-to-spend = balance − obligations (30 days) − minimum reserve − committed to pending proposals",
      });
    }

    case "getObligations": {
      const obligations = await repos.obligations.list();
      const upcoming = obligations
        .filter((o) => o.dueDate >= SEED_TODAY)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return JSON.stringify({
        obligations: upcoming.map((o) => ({
          name: o.name,
          amount: formatEuros(o.amountCents),
          dueDate: o.dueDate,
          category: o.category,
        })),
      });
    }

    case "getForecast": {
      const [business, obligations] = await Promise.all([
        repos.business.get(),
        repos.obligations.list(),
      ]);
      const fc = forecast30Day(business, obligations, SEED_TODAY);
      return JSON.stringify({
        startingBalance: formatEuros(fc.startingBalanceCents),
        totalObligations: formatEuros(fc.totalObligationsCents),
        projectedBalance: formatEuros(fc.projectedBalanceCents),
        note: "Conservative — assumes no new revenue arrives.",
      });
    }

    case "getSupplier": {
      const input = getSupplierSchema.parse(rawInput);
      const supplier = await repos.suppliers.getById(input.supplierId);
      if (!supplier) {
        return JSON.stringify({
          error: `Supplier "${input.supplierId}" not found`,
        });
      }
      return JSON.stringify({
        id: supplier.id,
        name: supplier.name,
        category: supplier.category,
        employeeApproved: supplier.employeeApproved,
        blocked: supplier.blocked,
        monthlyLimit: supplier.monthlyLimitCents
          ? formatEuros(supplier.monthlyLimitCents)
          : "none",
        spentThisMonth: formatEuros(supplier.spentThisMonthCents),
        remainingThisMonth: supplier.monthlyLimitCents
          ? formatEuros(
              supplier.monthlyLimitCents - supplier.spentThisMonthCents,
            )
          : "unlimited",
      });
    }

    case "checkPolicy": {
      const input = checkPolicySchema.parse(rawInput);
      const amountCents = parseAmountToCents(input.amount);
      const supplier = await repos.suppliers.getById(input.supplierId);
      if (!supplier) {
        return JSON.stringify({
          error: `Supplier "${input.supplierId}" not found`,
        });
      }
      const [policies, businessState] = await Promise.all([
        repos.policies.get(),
        buildBusinessState(repos, actor.id),
      ]);
      const decision = evaluatePolicy({
        amountCents,
        actor,
        supplier,
        businessState,
        policies,
      });
      return JSON.stringify({
        decision: decision.decision,
        requiredApproverRole: decision.requiredApproverRole ?? null,
        requiresConfirmation: decision.requiresConfirmation,
        reasons: decision.reasons,
      });
    }

    case "proposePayment": {
      const input = proposedPaymentSchema.parse(rawInput);
      const amountCents = parseAmountToCents(input.amount);
      const supplier = await repos.suppliers.getById(input.supplierId);
      if (!supplier) {
        return JSON.stringify({
          error: `Supplier "${input.supplierId}" not found`,
        });
      }
      const [policies, businessState] = await Promise.all([
        repos.policies.get(),
        buildBusinessState(repos, actor.id),
      ]);

      // Same circuit breaker lib/payments/execute.ts re-checks at execution
      // time — checked here too so the agent tells the user plainly rather
      // than creating a proposal that would just fail the moment anyone
      // tried to approve/confirm it.
      if (policies.paymentsPaused) {
        return JSON.stringify({
          created: false,
          decision: "rejected",
          reasons: [
            "All payments are currently paused for this business. No new proposals can be created until an owner resumes payments.",
          ],
        });
      }

      const decision = evaluatePolicy({
        amountCents,
        actor,
        supplier,
        businessState,
        policies,
      });

      if (decision.decision === "rejected") {
        return JSON.stringify({
          created: false,
          decision: "rejected",
          reasons: decision.reasons,
        });
      }

      let status: "approved" | "pending" | "awaiting_confirmation";
      if (decision.decision === "needs_approval") {
        status = "pending";
      } else if (decision.requiresConfirmation) {
        status = "awaiting_confirmation";
      } else {
        status = "approved";
      }

      const proposal = await repos.proposals.create({
        supplierId: input.supplierId,
        amountCents,
        currency: input.currency,
        reason: input.reason,
        proposedByActorId: actor.id,
        policyDecision: decision.decision,
        requiredApproverRole: decision.requiredApproverRole,
        requiresConfirmation: decision.requiresConfirmation,
        status,
      });

      const result: Record<string, unknown> = {
        created: true,
        proposalId: proposal.id,
        status: proposal.status,
        decision: decision.decision,
        reasons: decision.reasons,
        requiresConfirmation: decision.requiresConfirmation,
      };

      if (decision.decision === "needs_approval") {
        result.requiredApproverRole = decision.requiredApproverRole;
        result.message = `This payment requires ${decision.requiredApproverRole} approval. It has been added to the approval queue.`;
      } else if (decision.requiresConfirmation) {
        result.message = `This payment is above the ${formatEuros(policies.confirmationThresholdCents)} confirmation threshold. Please confirm it before it executes.`;
      } else {
        result.message =
          "Payment approved by policy. It will be executed automatically.";
        result.autoExecute = true;
      }

      return JSON.stringify(result);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
