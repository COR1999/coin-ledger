"use client";

import { useTransition } from "react";

import { selectActorAction } from "@/app/actions/session";
import type { Actor } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<Actor["role"], string> = {
  owner: "Owner",
  accountant: "Accountant",
  employee: "Employee",
};

/**
 * Demo role switcher. Posts the chosen actor to a server action that sets the
 * session cookie; the server re-reads it for authorization, so this control
 * only expresses intent — it never grants access on its own.
 */
export function RoleSwitcher({
  actors,
  currentActorId,
}: {
  actors: Actor[];
  currentActorId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label="Switch acting user"
      className="inline-flex items-center gap-1 rounded-lg border bg-card p-1"
    >
      {actors.map((actor) => {
        const active = actor.id === currentActorId;
        return (
          <form
            key={actor.id}
            action={(formData) =>
              startTransition(() => selectActorAction(formData))
            }
          >
            <input type="hidden" name="actorId" value={actor.id} />
            <button
              type="submit"
              aria-pressed={active}
              disabled={isPending}
              className={cn(
                "flex flex-col items-start rounded-md px-3 py-1.5 text-left transition-colors disabled:opacity-60",
                active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <span className="text-sm font-medium leading-tight">
                {actor.name}
              </span>
              <span
                className={cn(
                  "text-xs leading-tight",
                  active
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {ROLE_LABEL[actor.role]}
              </span>
            </button>
          </form>
        );
      })}
    </div>
  );
}
