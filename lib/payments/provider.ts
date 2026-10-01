import "server-only";

import { env } from "@/lib/env";
import { DEMO_WORKSPACE_ID } from "@/lib/repositories/singleton";
import { ArcPaymentProvider } from "./arc";
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";
import { isRealProviderAllowed } from "./workspace-provider-policy";

const cache = new Map<string, PaymentProvider>();

/**
 * Selects the payment provider for a workspace. One provider instance per
 * workspace per process. The actual safety rule (never real Arc outside the
 * demo workspace) lives in workspace-provider-policy.ts, where it's
 * unit-tested — this file isn't (see that file's comment).
 */
export function getPaymentProvider(
  workspaceId: string = DEMO_WORKSPACE_ID,
): PaymentProvider {
  const cached = cache.get(workspaceId);
  if (cached) return cached;

  const provider =
    isRealProviderAllowed(workspaceId) && env.PAYMENT_PROVIDER === "arc"
      ? new ArcPaymentProvider()
      : new MockPaymentProvider();
  cache.set(workspaceId, provider);
  return provider;
}
