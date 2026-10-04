import "server-only";

import {
  GoogleGenAI,
  type Content,
  type GenerateContentResponse,
} from "@google/genai";
import type { Actor, Supplier } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories/types";
import { toolDefinitions, executeTool } from "./tools";
import { formatEuros } from "@/lib/money";

const MAX_ITERATIONS = 10;
/**
 * Free-tier Gemini quota is scoped per model name (confirmed via direct API
 * calls, see BUILD_LOG) and is tight (as low as 20 requests/day on some
 * models) for a tool-calling agent that costs 2+ calls per turn. Rather than
 * fail a whole chat turn when one model's daily quota is exhausted, try each
 * model in order and stick with the first that works. Ordered by actual
 * evaluation, not just availability: gemini-3.5-flash is the considered
 * choice from Phase 3; the rest are same-family fallbacks confirmed to work
 * during Phase 6/7 quota exhaustion, not independently evaluated for
 * quality/latency.
 */
const MODEL_FALLBACK_CHAIN = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
] as const;
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 1000;

function isQuotaExhausted(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('"code":429');
}

function isTransientOverload(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('"code":503');
}

/**
 * Tries each model in `modelChain` in order. A 429 (quota exhausted) moves
 * to the next model immediately — backing off and retrying the same model
 * wastes time, since a daily quota won't reset within a few seconds. A 503
 * (transient overload) retries the same model with exponential backoff,
 * since that's a genuine transient condition on that model specifically.
 */
async function generateWithFallback(
  buildRequest: (model: string) => Promise<GenerateContentResponse>,
  modelChain: readonly string[],
): Promise<{ response: GenerateContentResponse; model: string }> {
  let lastError: unknown;
  for (const model of modelChain) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await buildRequest(model);
        return { response, model };
      } catch (error) {
        lastError = error;
        if (isQuotaExhausted(error)) {
          console.error(`Gemini quota exhausted for ${model}, falling back`);
          break;
        }
        if (!isTransientOverload(error) || attempt === MAX_RETRIES - 1) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, BASE_BACKOFF_MS * 2 ** attempt),
        );
      }
    }
  }
  throw lastError;
}

function buildSystemPrompt(
  actor: Actor,
  policies: {
    roles: Record<
      string,
      {
        maxSinglePaymentCents: number;
        dailyLimitCents: number | null;
        approvalLimitCents: number | null;
      }
    >;
    confirmationThresholdCents: number;
    minimumReserveCents: number;
    businessDailyLimitCents: number;
  },
  businessName: string,
  suppliers: readonly Pick<Supplier, "id" | "name">[],
): string {
  const roleLimits = policies.roles[actor.role];
  const knownSuppliers =
    suppliers.length > 0
      ? suppliers.map((s) => `${s.name} (${s.id})`).join(", ")
      : "none yet";
  return `You are the financial operator for ${businessName}. You help staff manage payments safely.

You are speaking with ${actor.name} (${actor.role}).

Their limits:
- Max single payment: ${formatEuros(roleLimits.maxSinglePaymentCents)}
- Daily limit: ${roleLimits.dailyLimitCents ? formatEuros(roleLimits.dailyLimitCents) : "none"}
- Approval limit: ${roleLimits.approvalLimitCents ? formatEuros(roleLimits.approvalLimitCents) : "cannot approve"}

Business rules:
- Payments above ${formatEuros(policies.confirmationThresholdCents)} require explicit confirmation
- Minimum reserve: ${formatEuros(policies.minimumReserveCents)}
- Business daily limit: ${formatEuros(policies.businessDailyLimitCents)}

Known suppliers: ${knownSuppliers}.

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
  const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  const [policies, business, suppliers] = await Promise.all([
    repos.policies.get(),
    repos.business.get(),
    repos.suppliers.list(),
  ]);

  const contents: Content[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let proposalId: string | undefined;
  let autoExecute = false;
  // Once a model proves it has quota, prefer it for the rest of this
  // conversation (consistent behavior turn-to-turn) but keep the full chain
  // as a safety net after it in case that model exhausts mid-conversation.
  let resolvedModel: string | undefined;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const chain = resolvedModel
      ? [
          resolvedModel,
          ...MODEL_FALLBACK_CHAIN.filter((m) => m !== resolvedModel),
        ]
      : MODEL_FALLBACK_CHAIN;

    const { response, model } = await generateWithFallback(
      (model) =>
        client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: buildSystemPrompt(
              actor,
              policies,
              business.name,
              suppliers,
            ),
            tools: [{ functionDeclarations: toolDefinitions }],
          },
        }),
      chain,
    );
    resolvedModel = model;

    const functionCalls = response.functionCalls;

    if (!functionCalls || functionCalls.length === 0) {
      return {
        message: response.text ?? "",
        proposalId,
        autoExecute,
      };
    }

    // Record the model's turn verbatim — the original parts carry the
    // thoughtSignature Gemini 3 requires when function calls are echoed back.
    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) {
      contents.push(modelContent);
    } else {
      contents.push({
        role: "model",
        parts: functionCalls.map((fc) => ({ functionCall: fc })),
      });
    }

    const responseParts: Content["parts"] = [];
    for (const call of functionCalls) {
      const name = call.name ?? "";
      try {
        const result = await executeTool(name, call.args ?? {}, repos, actor);

        const parsed = JSON.parse(result);
        if (parsed.proposalId) {
          proposalId = parsed.proposalId;
        }
        if (parsed.autoExecute) {
          autoExecute = true;
        }

        responseParts.push({
          functionResponse: {
            name,
            response: parsed,
          },
        });
      } catch (error) {
        responseParts.push({
          functionResponse: {
            name,
            response: {
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed",
            },
          },
        });
      }
    }

    contents.push({ role: "user", parts: responseParts });
  }

  return {
    message: "I was unable to complete the request. Please try again.",
    proposalId,
    autoExecute,
  };
}
