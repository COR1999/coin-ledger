"use server";

import { revalidatePath } from "next/cache";

import { setCurrentActor } from "@/lib/session";

/**
 * Switch the active demo actor (role switcher) and refresh the current view.
 * Silently no-ops on a malformed or unknown actor id (e.g. a stale/tampered
 * form value) rather than letting setCurrentActor's throw reach Next's
 * generic error page — every other mutating action in this app already
 * degrades to a typed result instead of an unhandled throw; this one had no
 * result to return (void, no UI to show an error in), so a no-op is the
 * equivalent of "ignore the bad input" rather than "crash the page."
 */
export async function selectActorAction(formData: FormData): Promise<void> {
  const actorId = formData.get("actorId");
  if (typeof actorId !== "string") return;
  try {
    await setCurrentActor(actorId);
  } catch {
    return;
  }
  revalidatePath("/", "layout");
}
