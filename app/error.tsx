"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary — covers every route, including the public landing
 * page (Phase 9). The "no payment moved" reassurance and "back to
 * dashboard" destination only make sense for the authenticated app shell;
 * a crash on the landing page (where nothing touches money) gets neutral
 * copy and sends an anonymous visitor back to the page they were actually
 * on, not into Mario's Coffee's dashboard.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const inAppShell = pathname !== "/" && pathname !== "/onboarding";

  useEffect(() => {
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {inAppShell
          ? "That action couldn't be completed. No payment has been moved — the server-side execution path only acts on checks it re-verifies itself, never on what the UI assumed. Try again, or go back to the dashboard."
          : "That page hit an error. Try again, or head back to the home page."}
      </p>
      <div className="mt-2 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button
          variant="outline"
          onClick={() => router.push(inAppShell ? "/app" : "/")}
        >
          {inAppShell ? "Back to dashboard" : "Back to home"}
        </Button>
      </div>
    </div>
  );
}
