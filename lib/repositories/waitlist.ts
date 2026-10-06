/**
 * Waitlist signups (Phase 9). Site-wide, not per-workspace — deliberately
 * separate from lib/repositories/workspace-store.ts's per-business
 * Repositories, since a signup isn't scoped to any one business.
 *
 * Same two-backend shape as workspace-store.ts, for the same reason: this
 * module stays pure/testable (no "server-only"), and whichever backend is
 * active is wired in once by waitlist-singleton.ts (server-only). In-memory
 * (default) is a `globalThis` array, process-lifetime only — confirmed not
 * to survive across Vercel serverless instances (BUILD_LOG.md, 2026-10-03:
 * a real signup landed via the live form but then "disappeared" — the
 * instance that served the admin view's read was never the one that served
 * the signup's write). This is a stopgap for that specific persistence bug,
 * not a decision about the still-open Resend question BUILD_LOG.md tracks
 * (audience/contacts API vs. transactional email) — addWaitlistSignup's and
 * listWaitlistSignups's signatures are unchanged, so swapping in Resend
 * later remains exactly as easy as it already was.
 */
import type { WaitlistSignup, WaitlistSignupInput } from "@/lib/domain/types";
import { runExclusive } from "@/lib/concurrency";
import type { KvClient } from "@/lib/repositories/kv-snapshot";

const WAITLIST_KEY = "waitlist:signups";

declare global {
  var __financialOperatorWaitlist: WaitlistSignup[] | undefined;
}

function signups(): WaitlistSignup[] {
  globalThis.__financialOperatorWaitlist ??= [];
  return globalThis.__financialOperatorWaitlist;
}

let kvClientProvider: (() => KvClient | null) | null = null;

/** Wired once by waitlist-singleton.ts (server-only); never by tests. */
export function setWaitlistKvClientProvider(
  provider: () => KvClient | null,
): void {
  kvClientProvider = provider;
}

function currentKvClient(): KvClient | null {
  return kvClientProvider ? kvClientProvider() : null;
}

async function loadFromKv(client: KvClient): Promise<WaitlistSignup[]> {
  const raw = await client.get(WAITLIST_KEY);
  return (raw as WaitlistSignup[] | null | undefined) ?? [];
}

export async function addWaitlistSignup(
  input: WaitlistSignupInput,
): Promise<WaitlistSignup> {
  const signup: WaitlistSignup = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  };

  const kv = currentKvClient();
  if (kv) {
    await runExclusive(WAITLIST_KEY, async () => {
      const current = await loadFromKv(kv);
      current.push(signup);
      await kv.set(WAITLIST_KEY, current);
    });
    return signup;
  }

  signups().push(signup);
  return signup;
}

export async function listWaitlistSignups(): Promise<WaitlistSignup[]> {
  const kv = currentKvClient();
  if (kv) return loadFromKv(kv);
  return [...signups()];
}
