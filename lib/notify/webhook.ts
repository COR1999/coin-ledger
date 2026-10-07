/**
 * Approval-notification webhook: the moment a proposal needs a human to act
 * (pending approval or awaiting confirmation — never an auto-approved
 * payment nobody needs to look at), POST a plain-language notice to an
 * owner-configured URL. Slack and Discord incoming webhooks are detected by
 * host and given their native payload shape so it renders natively in
 * either; anything else gets a generic JSON body, for Zapier/Make/a custom
 * listener. The agent's tool call awaits this (capped at 5s below) rather
 * than firing it detached — a detached promise has no guarantee of running
 * to completion once a serverless function's response has been sent, so
 * "fire and forget" would mean "sometimes never fires" here. What it
 * guarantees instead: a slow or dead webhook can delay the chat response by
 * up to 5s, but can never fail it — every error is caught and only logged.
 */
import { isIP } from "node:net";
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
 *
 * Rejecting *any* literal IP address (v4 or v6), rather than maintaining a
 * denylist of specific addresses, is the actual guard: a legitimate webhook
 * provider (Slack, Discord, Zapier, a custom domain) is always referenced
 * by hostname, never a raw IP. A denylist alone is bypassable — e.g.
 * `https://[::1]/hook` carries IPv6 brackets that survive into
 * `URL#hostname` as `"[::1]"`, which never matches a bare `"::1"` string
 * entry (caught in review, 2026-10-07, confirmed via `new URL(...).hostname`
 * directly). `node:net`'s `isIP` normalizes that for us instead of hand-
 * rolling IPv6/IPv4-mapped-IPv6 parsing.
 */
const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

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
      if (BLOCKED_HOSTNAMES.has(host)) return false;
      if (host.endsWith(".local") || host.endsWith(".internal")) return false;
      // Strip IPv6 brackets ("[::1]" -> "::1") before checking — isIP
      // only recognizes the unbracketed form.
      const unbracketed =
        host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
      if (isIP(unbracketed) !== 0) return false;
      return true;
    },
    { message: "Must be a valid https:// URL, not a local/internal address" },
  );

export interface ApprovalNotificationEvent {
  supplierName: string;
  amountDisplay: string;
  reason: string;
  /** The actor whose action just produced this state. */
  actorName: string;
  /**
   * What `actorName` just did. Deliberately a separate field from `action`
   * below, not derived from it: a proposal reaches "needs confirmation" two
   * different ways — proposed directly by someone with enough authority
   * that no escalation was needed (lib/agent/tools.ts, `verb: "proposed"`),
   * or approved into that state from "pending" by a separate approver
   * (app/actions/approvals.ts, `verb: "approved"`). Collapsing this into a
   * single field keyed off `action` said "Mario approved paying..." for a
   * proposal Mario had in fact proposed directly — caught in the first live
   * run of this notification, 2026-10-07.
   */
  verb: "proposed" | "approved";
  /** "needs your approval" vs "needs your confirmation" — the two states
   * that actually require a human, phrased for a non-technical reader. */
  action: "approval" | "confirmation";
  approvalsUrl: string;
}

function summaryLine(event: ApprovalNotificationEvent): string {
  return (
    `Coin Ledger: ${event.actorName} ${event.verb} paying ${event.supplierName} ` +
    `${event.amountDisplay} (${event.reason}) — needs ${event.action}. ${event.approvalsUrl}`
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
 * Awaited by the caller, but never allowed to fail or hang it: errors are
 * caught and logged server-side, never thrown, and a 5s timeout caps how
 * long a hanging endpoint can hold the agent's response open.
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
