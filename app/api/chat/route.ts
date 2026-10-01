import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgent, type AgentMessage } from "@/lib/agent/agent";
import { arcExplorerTxUrl, DEMO_SCALE_LABEL } from "@/lib/config";
import { executePayment } from "@/lib/payments/execute";
import { getPaymentProvider } from "@/lib/payments/provider";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor } from "@/lib/session";

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1),
    }),
  ),
});

const provider = getPaymentProvider();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = requestSchema.parse(body);

    const actor = await getCurrentActor();
    const repos = getRepositories();

    const response = await runAgent(messages as AgentMessage[], actor, repos);

    if (response.autoExecute && response.proposalId) {
      try {
        const execResult = await executePayment(
          response.proposalId,
          repos,
          provider,
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
        response.message += `\n\n✗ Payment execution failed: ${error instanceof Error ? error.message : "Unknown error"}`;
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
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
