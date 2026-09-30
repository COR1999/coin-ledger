import "server-only";

import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

import { env } from "@/lib/env";
import { toOnChainAmount } from "@/lib/config";
import type {
  PaymentProvider,
  PaymentStatus,
  PaymentSubmitRequest,
  PaymentSubmitResult,
} from "./types";

const EURC_TOKEN_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const ARC_TESTNET_BLOCKCHAIN = "ARC-TESTNET";

const TERMINAL_FAILED_STATES = new Set(["FAILED", "CANCELLED", "DENIED"]);

export class ArcPaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArcPaymentProviderError";
  }
}

/**
 * Real Arc testnet provider, backed by Circle developer-controlled wallets.
 * Verified against a live disposable transfer (BUILD_LOG.md § Testnet
 * transactions) before this was wired into the execution path.
 */
export class ArcPaymentProvider implements PaymentProvider {
  private client = initiateDeveloperControlledWalletsClient({
    apiKey: requireEnv("CIRCLE_API_KEY"),
    entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
  });

  async submit(req: PaymentSubmitRequest): Promise<PaymentSubmitResult> {
    const response = await this.client.createTransaction({
      walletAddress: requireEnv("CIRCLE_WALLET_ADDRESS"),
      blockchain: ARC_TESTNET_BLOCKCHAIN,
      tokenAddress: EURC_TOKEN_ADDRESS,
      destinationAddress: req.to,
      amount: [toOnChainAmount(req.amount)],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      idempotencyKey: req.idempotencyKey,
    });

    const paymentId = response.data?.id;
    if (!paymentId) {
      throw new ArcPaymentProviderError(
        "Circle createTransaction returned no transaction id",
      );
    }
    return { paymentId, status: "pending" };
  }

  async getStatus(paymentId: string): Promise<PaymentStatus> {
    const response = await this.client.getTransaction({ id: paymentId });
    const tx = response.data?.transaction;
    if (!tx) {
      throw new ArcPaymentProviderError(`Unknown transaction: ${paymentId}`);
    }

    if (tx.state === "COMPLETE") {
      return { status: "confirmed", txHash: tx.txHash ?? undefined };
    }
    if (tx.state && TERMINAL_FAILED_STATES.has(tx.state)) {
      return {
        status: "failed",
        failureReason: `Circle transaction ended in state ${tx.state}`,
      };
    }
    return { status: "pending" };
  }
}

function requireEnv(
  key: "CIRCLE_API_KEY" | "CIRCLE_ENTITY_SECRET" | "CIRCLE_WALLET_ADDRESS",
): string {
  const value = env[key];
  if (!value) {
    throw new ArcPaymentProviderError(
      `${key} is required when PAYMENT_PROVIDER=arc`,
    );
  }
  return value;
}
