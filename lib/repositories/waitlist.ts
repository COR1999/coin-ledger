/**
 * Waitlist signups (Phase 9). Site-wide, not per-workspace — deliberately
 * separate from lib/repositories/workspace-store.ts's per-business
 * Repositories, since a signup isn't scoped to any one business. In-memory,
 * same persistence model as everything else in this build: survives for the
 * life of the server process, not a restart.
 */
import type { WaitlistSignup, WaitlistSignupInput } from "@/lib/domain/types";

declare global {
  var __financialOperatorWaitlist: WaitlistSignup[] | undefined;
}

function signups(): WaitlistSignup[] {
  globalThis.__financialOperatorWaitlist ??= [];
  return globalThis.__financialOperatorWaitlist;
}

export function addWaitlistSignup(input: WaitlistSignupInput): WaitlistSignup {
  const signup: WaitlistSignup = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  };
  signups().push(signup);
  return signup;
}

export function listWaitlistSignups(): WaitlistSignup[] {
  return [...signups()];
}
