/**
 * Workspace selection (demo). Same pattern as lib/session.ts's actor cookie:
 * no real auth, a cookie holding a workspace id, enforced server-side.
 *
 * Server-only: never import from a client component.
 */
import "server-only";

import { cookies } from "next/headers";

import {
  DEMO_WORKSPACE_ID,
  workspaceExists,
} from "@/lib/repositories/singleton";

const WORKSPACE_COOKIE = "workspaceId";

/**
 * The workspace for the current request. Falls back to the demo workspace if
 * the cookie is absent or points at a workspace that no longer exists
 * (in-memory state does not survive a server restart) — never throws, so a
 * stale cookie degrades to the canned demo instead of breaking the page.
 */
export async function getCurrentWorkspaceId(): Promise<string> {
  const store = await cookies();
  const id = store.get(WORKSPACE_COOKIE)?.value;
  if (!id || id === DEMO_WORKSPACE_ID) return DEMO_WORKSPACE_ID;
  return workspaceExists(id) ? id : DEMO_WORKSPACE_ID;
}

/** Persist the selected workspace (set once, by onboarding, after creation). */
export async function setCurrentWorkspaceId(
  workspaceId: string,
): Promise<void> {
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
