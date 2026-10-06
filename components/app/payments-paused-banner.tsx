import Link from "next/link";

/**
 * Shown on every page where a payment could otherwise be proposed, approved,
 * confirmed, or retried — not just Settings, where the toggle actually lives
 * — so nobody discovers the pause only after an action silently fails. The
 * real enforcement is server-side (lib/payments/execute.ts,
 * lib/agent/tools.ts); this is purely informational.
 */
export function PaymentsPausedBanner() {
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-red-600/40 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-200"
    >
      <span className="font-semibold">All payments are paused.</span> No
      proposal can execute until an owner resumes them in{" "}
      <Link href="/settings" className="underline underline-offset-2">
        Policies
      </Link>
      .
    </div>
  );
}
