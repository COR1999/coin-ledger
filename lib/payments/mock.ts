import type {
  PaymentProvider,
  PaymentStatus,
  PaymentSubmitRequest,
  PaymentSubmitResult,
} from "./types";

const SETTLE_MS = 1000;
const FAILURE_RATE = 0.1;

interface PendingPayment {
  settleAt: number;
  willFail: boolean;
  txHash: string;
}

export class MockPaymentProvider implements PaymentProvider {
  private payments = new Map<string, PendingPayment>();
  private counter = 0;

  async submit(req: PaymentSubmitRequest): Promise<PaymentSubmitResult> {
    if (this.payments.has(req.idempotencyKey)) {
      return { paymentId: req.idempotencyKey, status: "pending" };
    }

    this.counter += 1;
    const paymentId = req.idempotencyKey;
    this.payments.set(paymentId, {
      settleAt: Date.now() + SETTLE_MS,
      willFail: Math.random() < FAILURE_RATE,
      txHash: `0x${this.counter.toString(16).padStart(64, "0")}`,
    });

    return { paymentId, status: "pending" };
  }

  async getStatus(paymentId: string): Promise<PaymentStatus> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Unknown payment: ${paymentId}`);
    }

    if (Date.now() < payment.settleAt) {
      return { status: "pending" };
    }

    if (payment.willFail) {
      return {
        status: "failed",
        failureReason: "Simulated transaction failure",
      };
    }

    return { status: "confirmed", txHash: payment.txHash };
  }
}
