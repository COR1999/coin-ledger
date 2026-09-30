export interface PaymentSubmitRequest {
  idempotencyKey: string;
  to: string;
  amount: string;
  currency: "EURC" | "USDC";
}

export interface PaymentSubmitResult {
  paymentId: string;
  status: "pending";
}

export interface PaymentStatus {
  status: "pending" | "confirmed" | "failed";
  txHash?: string;
  failureReason?: string;
}

export interface PaymentProvider {
  submit(req: PaymentSubmitRequest): Promise<PaymentSubmitResult>;
  getStatus(paymentId: string): Promise<PaymentStatus>;
}
