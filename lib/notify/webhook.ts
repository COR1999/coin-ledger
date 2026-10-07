/**
 * Approval-notification webhook: the moment a proposal needs a human to act
 * (pending approval or awaiting confirmation — never an auto-approved
 * payment nobody needs to look at), POST a plain-language notice to an
 * owner-configured URL. Slack and Discord incoming webhooks are detected by
 * host and given their native payload shape so it renders natively in
 * either; anything else gets a generic JSON body, for Zapier/Make/a custom
 * listener. Fire-and-forget from the agent's tool call — a slow or dead
 * webhook must never block or fail the chat response that triggered it.
 */
import { z } from "zod";

/**
 * Validated at the settings boundary, not just the webhook call site —
 * zod at every boundary per CLAUDE.md. Requires https (no plaintext
 * credentials-in-URL over the wire) and rejects hostnames that are
 * obviously loopback, link-local, or a cloud metadata endpoint (the classic
 * SSRF target: a server tricked into fetching its own cloud provider's
 * instance-metadata service). This is a string-level allowlist/denylist,
 * not DNS-resolution-based SSRF defense — it blocks the common, careless
 * cases; it does not replace an egress proxy for a server that handles
 * genuinely untrusted URLs. Here the URL is owner-entered, not
 * attacker-supplied, which is why this lighter guard is a reasonable match
 * for what it's defending.
 */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // AWS/GCP/Azure instance metadata
  "metadata.google.internal",
]);

export const webhookUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => {
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        return false;
      }
      if (parsed.protocol !== "https:") return false;
      const host = parsed.hostname.toLowerCase();
      if (BLOCKED_HOSTS.has(host)) return false;
      if (host.startsWith("169.254.") || host.startsWith("127.")) return false;
      if (host.endsWith(".local") || host.endsWith(".internal")) return false;
      return true;
    },
    { message: "Must be a valid https:// URL, not a local/internal address" },
  );

export interface ApprovalNotificationEvent {
  supplierName: string;
  amountDisplay: string;
  reason: string;
  proposedByName: string;
  /** "needs your approval" vs "needs your confirmation" — the two states
   * that actually require a human, phrased for a non-technical reader. */
  action: "approval" | "confirmation";
  approvalsUrl: string;
}

function summaryLine(event: ApprovalNotificationEvent): string {
  const verb = event.action === "approval" ? "approval" : "confirmation";
  return (
    `Coin Ledger: ${event.proposedByName} proposed paying ${event.supplierName} ` +
    `${event.amountDisplay} (${event.reason}) — needs ${verb}. ${event.approvalsUrl}`
  );
}

/** Pure payload shaping — no network — so the three branches are each
 * independently testable without mocking fetch. */
export function buildWebhookPayload(
  url: string,
  event: ApprovalNotificationEvent,
): Record<string, unknown> {
  const host = new URL(url).hostname.toLowerCase();
  const text = summaryLine(event);

  if (host.endsWith("hooks.slack.com")) {
    return { text };
  }
  if (host.endsWith("discord.com") || host.endsWith("discordapp.com")) {
    return { content: text };
  }
  return {
    event: "proposal_needs_action",
    message: text,
    ...event,
  };
}

/**
 * Fire-and-forget: errors are caught and logged server-side, never thrown,
 * so a down or misconfigured webhook can't fail the chat response that
 * triggered it. A 5s timeout for the same reason — a hanging endpoint must
 * not hold the agent's response open indefinitely.
 */
export async function sendApprovalNotification(
  url: string,
  event: ApprovalNotificationEvent,
): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildWebhookPayload(url, event)),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    console.error("Approval notification webhook failed:", error);
  }
}
