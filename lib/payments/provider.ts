import "server-only";

import { env } from "@/lib/env";
import { ArcPaymentProvider } from "./arc";
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

let cached: PaymentProvider | undefined;

/** Selects the payment provider from PAYMENT_PROVIDER. One instance per process. */
export function getPaymentProvider(): PaymentProvider {
  if (!cached) {
    cached =
      env.PAYMENT_PROVIDER === "arc"
        ? new ArcPaymentProvider()
        : new MockPaymentProvider();
  }
  return cached;
}
