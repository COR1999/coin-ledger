"use server";

import { revalidatePath } from "next/cache";

import { setCurrentActor } from "@/lib/session";

/** Switch the active demo actor (role switcher) and refresh the current view. */
export async function selectActorAction(formData: FormData): Promise<void> {
  const actorId = formData.get("actorId");
  if (typeof actorId !== "string") return;
  await setCurrentActor(actorId);
  revalidatePath("/", "layout");
}
