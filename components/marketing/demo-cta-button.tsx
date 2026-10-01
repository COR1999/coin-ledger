"use client";

import { ArrowRight } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * Submit button for the "Try the demo" form (returnToDemoAction). Reads
 * pending state from the nearest parent <form> via useFormStatus rather
 * than useActionState, since the action itself just redirects and has no
 * result to thread back — this is the smaller change for a fire-and-forget
 * action, and still satisfies "loading state for every async action."
 */
export function DemoCtaButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? (
        "Loading demo…"
      ) : (
        <>
          Try the demo <ArrowRight className="size-4" />
        </>
      )}
    </Button>
  );
}
