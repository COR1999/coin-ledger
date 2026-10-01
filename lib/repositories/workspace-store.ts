/**
 * The pure workspace Map — no cookies, no env, no secrets. Split out of
 * singleton.ts (which re-exports this under an `import "server-only"` guard)
 * purely so it can be unit tested: `server-only` throws unconditionally
 * under Vitest's plain Node runtime (Next's webpack aliases it to a no-op
 * on the server build; Vitest doesn't), so nothing that transitively loads
 * it is testable — same reason lib/env.ts is split from lib/env.schema.ts.
 */
import { createInMemoryRepositories } from "@/lib/repositories/in-memory";
import type { Repositories } from "@/lib/repositories/types";

export const DEMO_WORKSPACE_ID = "demo";

declare global {
  var __financialOperatorWorkspaces: Map<string, Repositories> | undefined;
}

function workspaces(): Map<string, Repositories> {
  globalThis.__financialOperatorWorkspaces ??= new Map();
  return globalThis.__financialOperatorWorkspaces;
}

/**
 * Repositories for a workspace, creating the demo workspace lazily on first
 * access. An unknown non-demo id (e.g. the server restarted, so a visitor's
 * in-memory workspace is gone) falls back to the demo workspace rather than
 * throwing — `lib/workspace.ts` is what actually decides which id a request
 * uses, and it performs the same `workspaceExists` check before trusting a
 * visitor's cookie, so this fallback is a last-resort safety net, not the
 * primary mechanism.
 */
export function getRepositories(
  workspaceId: string = DEMO_WORKSPACE_ID,
): Repositories {
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

/** True if a workspace's in-memory state currently exists. */
export function workspaceExists(workspaceId: string): boolean {
  return workspaces().has(workspaceId);
}

/** Registers a freshly built workspace (see `lib/onboarding.ts`). */
export function registerWorkspace(
  workspaceId: string,
  repos: Repositories,
): void {
  workspaces().set(workspaceId, repos);
}
