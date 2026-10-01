/**
 * Session (demo). There is no real auth: the "current actor" is a cookie holding
 * a known actor id, driving the role switcher. Resolved and enforced on the
 * server — client-supplied role claims are never trusted for authorization.
 *
 * Actor sets are per-workspace (see lib/workspace.ts) — the demo business has
 * its three fixed actors, and a workspace created via onboarding (Phase 8)
 * has its own. `actorIdSchema`'s old static zod enum, built once from the
 * demo's seedActors, could no longer validate every workspace's ids, so
 * validation here is a runtime check against the live list instead.
 *
 * Server-only: never import from a client component.
 */
import "server-only";

import { cookies } from "next/headers";

import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import type { Actor } from "@/lib/domain/types";

const ACTOR_COOKIE = "actorId";

/** Actors for the current workspace. */
export async function listActors(): Promise<Actor[]> {
  const workspaceId = await getCurrentWorkspaceId();
  return getRepositories(workspaceId).actors.list();
}

/** The actor for the current request, defaulting to the owner. */
export async function getCurrentActor(): Promise<Actor> {
  const [store, actors] = await Promise.all([cookies(), listActors()]);
  const id = store.get(ACTOR_COOKIE)?.value;
  const owner = actors.find((a) => a.role === "owner") ?? actors[0];
  return actors.find((a) => a.id === id) ?? owner;
}

/** Persist the selected actor. Rejects ids not in the current workspace. */
export async function setCurrentActor(actorId: string): Promise<void> {
  const actors = await listActors();
  if (!actors.some((a) => a.id === actorId)) {
    throw new Error(`Unknown actor: ${actorId}`);
  }
  const store = await cookies();
  store.set(ACTOR_COOKIE, actorId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
