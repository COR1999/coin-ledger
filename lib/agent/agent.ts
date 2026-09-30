import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { Actor } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories/types";
import { toolDefinitions, executeTool } from "./tools";
import { formatEuros } from "@/lib/money";

const MAX_ITERATIONS = 10;

function buildSystemPrompt(actor: Actor, policies: {
  roles: Record<string, { maxSinglePaymentCents: number; dailyLimitCents: number | null; approvalLimitCents: number | null }>;
  confirmationThresholdCents: number;
  minimumReserveCents: number;
  businessDailyLimitCents: number;
}): string {
  const roleLimits = policies.roles[actor.role];
  return `You are the financial operator for Mario's Coffee, a small café. You help staff manage payments safely.

You are speaking with ${actor.name} (${actor.role}).

Their limits:
- Max single payment: ${formatEuros(roleLimits.maxSinglePaymentCents)}
- Daily limit: ${roleLimits.dailyLimitCents ? formatEuros(roleLimits.dailyLimitCents) : "none"}
- Approval limit: ${roleLimits.approvalLimitCents ? formatEuros(roleLimits.approvalLimitCents) : "cannot approve"}

Business rules:
- Payments above ${formatEuros(policies.confirmationThresholdCents)} require explicit confirmation
- Minimum reserve: ${formatEuros(policies.minimumReserveCents)}
- Business daily limit: ${formatEuros(policies.businessDailyLimitCents)}

Known suppliers: ABC Coffee (abc-coffee), Local Veg Supplier (local-veg), Unknown Vendor Ltd (unknown-vendor).

RULES:
- Use tools to look up real data. Never invent numbers.
- When asked about a payment, always use checkPolicy first to explain what would happen.
- When the user wants to make a payment, use proposePayment to create a proposal.
- Explain policy decisions using the reasons from the policy engine.
- Be concise and professional. This is a finance tool, not a chatbot.
- If a payment is rejected, explain exactly which rule(s) it violates.
- If a payment needs approval, explain who needs to approve it and why.
- Never claim a payment was made — you can only create proposals.`;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  message: string;
  proposalId?: string;
  autoExecute?: boolean;
}

export async function runAgent(
  messages: AgentMessage[],
  actor: Actor,
  repos: Repositories,
): Promise<AgentResponse> {
  const client = new Anthropic();
  const policies = await repos.policies.get();

  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let proposalId: string | undefined;
  let autoExecute = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 4096,
      system: buildSystemPrompt(actor, policies),
      tools: toolDefinitions,
      messages: apiMessages,
    });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      return {
        message: textBlock?.text ?? "",
        proposalId,
        autoExecute,
      };
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      apiMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tool of toolUseBlocks) {
        try {
          const result = await executeTool(
            tool.name,
            tool.input,
            repos,
            actor,
          );

          const parsed = JSON.parse(result);
          if (parsed.proposalId) {
            proposalId = parsed.proposalId;
          }
          if (parsed.autoExecute) {
            autoExecute = true;
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: tool.id,
            content: result,
          });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tool.id,
            content: JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed",
            }),
            is_error: true,
          });
        }
      }

      apiMessages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return {
    message: "I was unable to complete the request. Please try again.",
    proposalId,
    autoExecute,
  };
}
