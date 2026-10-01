/**
 * Pure predicate, split out of provider.ts so it's unit-testable: provider.ts
 * carries "server-only" and constructs the real Circle SDK client, which
 * throws under Vitest's plain Node runtime (same reason arc.ts has no unit
 * tests — see its own comment) and isn't worth a DI refactor at hackathon
 * scale. This file has no such import, so the one rule that actually matters
 * — no onboarding workspace may ever reach the real provider — gets real
 * test coverage without touching either of those.
 */
import { DEMO_WORKSPACE_ID } from "@/lib/repositories/workspace-store";

/**
 * Only the demo workspace may use whatever PAYMENT_PROVIDER selects. Every
 * other workspace (one per visitor who completes onboarding — Phase 8) is
 * always mock — no visitor should need a real Circle wallet provisioned
 * just to try the app.
 */
export function isRealProviderAllowed(workspaceId: string): boolean {
  return workspaceId === DEMO_WORKSPACE_ID;
}
