import { describeError } from "@/lib/log-error";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toActionErrorMessage } from "@/lib/action-error";
import { runAgent } from "@/lib/agent/agent";
import { arcExplorerTxUrl, DEMO_SCALE_LABEL } from "@/lib/config";
import { env } from "@/lib/env";
import { executePayment } from "@/lib/payments/execute";
import { getExecutionLock } from "@/lib/payments/execution-lock";
import { getPaymentProvider } from "@/lib/payments/provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";

/** Upper bounds on what one request may forward to the model. The client
 * resends the whole history every turn, so without caps a single crafted
 * request could push megabytes of tokens and exhaust the shared AI quota.
 * Both are far above a real demo conversation. */
const MAX_CHAT_MESSAGES = 100;
const MAX_MESSAGE_CHARS = 10_000;

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_CHAT_MESSAGES),
});

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Absolute origin for a clickable /approvals link inside an approval-
 * notification webhook. Prefers an explicit override (a custom domain,
 * where VERCEL_URL would give the wrong aliased hostname); falls back to
 * Vercel's own per-deployment URL; undefined in local dev with neither set
 * — lib/agent/tools.ts degrades to a relative path in that case. */
function resolveAppBaseUrl(): string | undefined {
  if (env.APP_BASE_URL) return env.APP_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

export async function POST(req: NextRequest) {
  const rateLimitResult = checkRateLimit(
    await getClientIp(),
    env.CHAT_RATE_LIMIT_PER_HOUR,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: `This demo limits chat messages per visitor to keep it available for everyone. Please try again in about ${Math.ceil((rateLimitResult.retryAfterSeconds ?? 60) / 60)} minute(s).`,
      },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const { messages } = requestSchema.parse(body);

    const workspaceId = await getCurrentWorkspaceId();
    const actor = await getCurrentActor();
    const repos = getRepositories(workspaceId);
    const provider = getPaymentProvider(workspaceId);

    const response = await runAgent(
      messages,
      actor,
      repos,
      resolveAppBaseUrl(),
    );

    if (response.autoExecute && response.proposalId) {
      try {
        const execResult = await executePayment(
          response.proposalId,
          repos,
          provider,
          { lock: getExecutionLock(workspaceId) },
        );
        if (execResult.status === "confirmed") {
          response.message +=
            `\n\n✓ Payment executed on-chain: ${execResult.onChainAmount} (${DEMO_SCALE_LABEL}).` +
            `\nTx hash: \`${execResult.txHash}\`` +
            `\n${arcExplorerTxUrl(execResult.txHash!)}`;
        } else if (execResult.status === "failed") {
          response.message += `\n\n✗ Payment execution failed: ${execResult.failureReason}. The proposal has been marked as failed.`;
        } else {
          response.message += `\n\n⏳ Payment submitted and pending confirmation.`;
        }
      } catch (error) {
        response.message += `\n\n✗ Payment execution failed: ${toActionErrorMessage(error, "chat auto-execute")}`;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Chat API error:", describeError(error));
    const message = error instanceof Error ? error.message : "";
    // runAgent only throws a 429 after exhausting every model in its
    // fallback chain (lib/agent/agent.ts) — distinct from this route's own
    // rate limiter, which never reaches here.
    if (message.includes('"code":429')) {
      return NextResponse.json(
        {
          error:
            "This demo has hit its free daily AI quota. Please check back tomorrow.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
