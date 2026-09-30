/**
 * Session (demo). There is no real auth: the "current actor" is a cookie holding
 * a known actor id, driving the role switcher. Resolved and enforced on the
 * server — client-supplied role claims are never trusted for authorization.
 *
 * Server-only: never import from a client component.
 */
import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { seedActors } from "@/lib/data/seed";
import type { Actor } from "@/lib/domain/types";

const ACTOR_COOKIE = "actorId";
const DEFAULT_ACTOR_ID = "mario";

export const actorIdSchema = z.enum(
  seedActors.map((a) => a.id) as [string, ...string[]],
);

export function listActors(): Actor[] {
  return seedActors;
}

/** The actor for the current request, defaulting to the owner. */
export async function getCurrentActor(): Promise<Actor> {
  const store = await cookies();
  const id = store.get(ACTOR_COOKIE)?.value;
  return (
    seedActors.find((a) => a.id === id) ??
    seedActors.find((a) => a.id === DEFAULT_ACTOR_ID)!
  );
}

/** Persist the selected actor. Rejects unknown ids. */
export async function setCurrentActor(actorId: string): Promise<void> {
  const id = actorIdSchema.parse(actorId);
  const store = await cookies();
  store.set(ACTOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
