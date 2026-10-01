import "server-only";

import {
  GoogleGenAI,
  type Content,
  type GenerateContentResponse,
} from "@google/genai";
import type { Actor } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories/types";
import { toolDefinitions, executeTool } from "./tools";
import { formatEuros } from "@/lib/money";

const MAX_ITERATIONS = 10;
const MODEL = "gemini-3.6-flash";
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 1000;

function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('"code":503') || message.includes('"code":429');
}

async function generateWithRetry(
  fn: () => Promise<GenerateContentResponse>,
): Promise<GenerateContentResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === MAX_RETRIES - 1) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, BASE_BACKOFF_MS * 2 ** attempt),
      );
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
): string {
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
  const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  const policies = await repos.policies.get();

  const contents: Content[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let proposalId: string | undefined;
  let autoExecute = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await generateWithRetry(() =>
      client.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: buildSystemPrompt(actor, policies),
          tools: [{ functionDeclarations: toolDefinitions }],
        },
      }),
    );

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
        const result = await executeTool(
          name,
          call.args ?? {},
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
