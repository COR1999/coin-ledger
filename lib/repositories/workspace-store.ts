/**
 * The pure workspace store — no cookies, no env, no secrets. Split out of
 * singleton.ts (which re-exports this under an `import "server-only"` guard)
 * purely so it can be unit tested: `server-only` throws unconditionally
 * under Vitest's plain Node runtime (Next's webpack aliases it to a no-op
 * on the server build; Vitest doesn't), so nothing that transitively loads
 * it is testable — same reason lib/env.ts is split from lib/env.schema.ts.
 *
 * Two storage backends, same exported functions:
 *  - In-memory (default): a `globalThis`-backed Map, process-lifetime only.
 *    Confirmed not to survive across Vercel serverless instances (BUILD_LOG,
 *    2026-10-03) — not fine for a visitor's onboarded business, but exactly
 *    right for the demo workspace specifically (see below).
 *  - Redis (lib/repositories/kv-snapshot.ts), when a client has been wired
 *    in via `setKvClientProvider` — real data surviving across instances.
 *    Wiring happens in singleton.ts (server-only), never in tests, so every
 *    test in this file exercises the in-memory path exactly as before.
 *
 * The demo workspace always uses the in-memory backend, even when Redis is
 * configured — deliberately, not an oversight. Redis exists to stop a real
 * visitor's onboarded business from vanishing; it was never meant to make
 * the demo *permanent*. A demo workspace that persisted on Redis would
 * accumulate every visitor's test payments forever (no more per-cold-start
 * reset), so a judge or a second visitor could land on a Mario's Coffee
 * already drawn down by someone else's earlier click-through — confirmed as
 * a live risk, not just a theoretical one, while verifying the Redis
 * rollout (2026-10-06). Every onboarded (`ws-...`) workspace still gets the
 * durable Redis path when configured.
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
  if (kv && workspaceId !== DEMO_WORKSPACE_ID) {
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

/** True if a workspace's state currently exists (in-memory or Redis). */
export async function workspaceExists(workspaceId: string): Promise<boolean> {
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
