/**
 * The pure workspace store — no cookies, no env, no secrets. Split out of
 * singleton.ts (which re-exports this under an `import "server-only"` guard)
 * purely so it can be unit tested: `server-only` throws unconditionally
 * under Vitest's plain Node runtime (Next's webpack aliases it to a no-op
 * on the server build; Vitest doesn't), so nothing that transitively loads
 * it is testable — same reason lib/env.ts is split from lib/env.schema.ts.
 *
 * Two storage backends, same exported functions:
 *  - In-memory (default, when Redis isn't configured): a `globalThis`-backed
 *    Map, process-lifetime only. Confirmed not to survive across Vercel
 *    serverless instances (BUILD_LOG, 2026-10-03).
 *  - Redis (lib/repositories/kv-snapshot.ts), when a client has been wired
 *    in via `setKvClientProvider` — real data surviving across instances.
 *    Wiring happens in singleton.ts (server-only), never in tests, so every
 *    test in this file exercises the in-memory path exactly as before.
 *
 * The demo workspace used to be forced onto the in-memory backend even when
 * Redis was configured, specifically so it would reset on every cold start
 * rather than accumulate every visitor's test payments forever. Reverted
 * (2026-10-06): verifying the transparency-page feature live showed that
 * "reset on cold start" doesn't actually hold — a payment executed via
 * /chat was already gone from /transactions loaded ~15s later in the same
 * session, meaning Vercel was routing those two requests to different
 * serverless instances with separate in-memory state, not just reverting
 * on a cold start. A demo that can lose the payment you just watched it
 * make is worse than a demo that occasionally shows a previous visitor's
 * leftover state, so the demo now gets the same durable Redis path as every
 * onboarded workspace, plus a time-based auto-reset (`DEMO_RESET_AFTER_MS`,
 * see getRepositories below) so it still doesn't drift forever — see
 * KvRepositories' `resetPolicy` in kv-snapshot.ts for the mechanism. Only
 * the demo workspace is ever given a reset policy; a real visitor's
 * onboarded business must never be silently wiped.
 */
import {
  seedActors,
  seedBusiness,
  seedObligations,
  seedPolicies,
  seedSuppliers,
  seedTransactions,
} from "@/lib/data/seed";
import {
  createInMemoryRepositories,
  type RepositorySeedData,
} from "@/lib/repositories/in-memory";
import {
  KvRepositories,
  kvWorkspaceExists,
  registerKvWorkspace,
  type KvClient,
} from "@/lib/repositories/kv-snapshot";
import type { Repositories } from "@/lib/repositories/types";

export const DEMO_WORKSPACE_ID = "demo";

/** How long the demo workspace's Redis snapshot can go untouched before the
 * next request reseeds it back to a clean Mario's Coffee. Long enough that
 * a single visitor's or judge's click-through session never gets reset out
 * from under them; short enough that the demo doesn't stay drawn-down by
 * someone else's testing indefinitely. */
export const DEMO_RESET_AFTER_MS = 6 * 60 * 60 * 1000;

declare global {
  var __financialOperatorWorkspaces: Map<string, Repositories> | undefined;
}

function workspaces(): Map<string, Repositories> {
  globalThis.__financialOperatorWorkspaces ??= new Map();
  return globalThis.__financialOperatorWorkspaces;
}

function demoSeedData(): RepositorySeedData {
  return {
    business: seedBusiness,
    actors: seedActors,
    suppliers: seedSuppliers,
    transactions: seedTransactions,
    policies: seedPolicies,
    obligations: seedObligations,
  };
}

let kvClientProvider: (() => KvClient | null) | null = null;

/**
 * Wires in the real Redis client factory. Called exactly once, by
 * singleton.ts (server-only) at module load — never by tests, so
 * `currentKvClient()` always returns null under Vitest and every function
 * below exercises the in-memory path, unchanged from before this file
 * supported a second backend.
 */
export function setKvClientProvider(provider: () => KvClient | null): void {
  kvClientProvider = provider;
}

function currentKvClient(): KvClient | null {
  return kvClientProvider ? kvClientProvider() : null;
}

/**
 * Repositories for a workspace, creating the demo workspace lazily on first
 * access. An unknown non-demo id (e.g. the server restarted, so a visitor's
 * in-memory workspace is gone) falls back to the demo workspace rather than
 * throwing — `lib/workspace.ts` is what actually decides which id a request
 * uses, and it performs the same `workspaceExists` check before trusting a
 * visitor's cookie, so this fallback is a last-resort safety net for the
 * in-memory backend specifically. The Redis backend has no equivalent
 * fallback here: it trusts `lib/workspace.ts` has already resolved a valid
 * id (the only caller of this function in the app), since constructing a
 * `KvRepositories` can't synchronously check Redis for existence the way the
 * in-memory `Map.has` can.
 */
export function getRepositories(
  workspaceId: string = DEMO_WORKSPACE_ID,
): Repositories {
  const kv = currentKvClient();
  if (kv) {
    if (workspaceId === DEMO_WORKSPACE_ID) {
      return new KvRepositories(kv, workspaceId, demoSeedData, {
        maxAgeMs: DEMO_RESET_AFTER_MS,
      });
    }
    return new KvRepositories(kv, workspaceId, demoSeedData);
  }

  const store = workspaces();
  let repos = store.get(workspaceId);
  if (!repos) {
    if (workspaceId !== DEMO_WORKSPACE_ID) {
      return getRepositories(DEMO_WORKSPACE_ID);
    }
    repos = createInMemoryRepositories();
    store.set(DEMO_WORKSPACE_ID, repos);
  }
  return repos;
}

/**
 * True if a workspace's state currently exists (in-memory or Redis). The
 * demo workspace always reports true, on either backend, without checking:
 * `getRepositories` already treats it as never truly "missing" (lazily
 * seeded on first access rather than requiring registration), and on Redis
 * specifically, a pure read against a never-yet-touched demo doesn't
 * persist anything — the key can legitimately not exist yet even though
 * the demo itself is always available.
 */
export async function workspaceExists(workspaceId: string): Promise<boolean> {
  if (workspaceId === DEMO_WORKSPACE_ID) return true;
  const kv = currentKvClient();
  if (kv) return kvWorkspaceExists(kv, workspaceId);
  return workspaces().has(workspaceId);
}

/** Registers a freshly built workspace (see `lib/onboarding.ts`) from its
 * raw seed data — not a pre-built `Repositories` — so the same data can seed
 * either backend. */
export async function registerWorkspace(
  workspaceId: string,
  data: RepositorySeedData,
): Promise<void> {
  const kv = currentKvClient();
  if (kv) {
    await registerKvWorkspace(kv, workspaceId, data);
    return;
  }
  workspaces().set(workspaceId, createInMemoryRepositories(data));
}
