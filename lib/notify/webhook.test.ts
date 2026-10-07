import { describe, expect, it } from "vitest";

import { buildWebhookPayload, webhookUrlSchema } from "./webhook";

const EVENT = {
  supplierName: "ABC Coffee",
  amountDisplay: "€2,400",
  reason: "Monthly beans delivery",
  actorName: "Liam",
  verb: "proposed" as const,
  action: "approval" as const,
  approvalsUrl: "https://financial-operator.vercel.app/approvals",
};

describe("webhookUrlSchema", () => {
  it("accepts a normal https URL", () => {
    expect(
      webhookUrlSchema.safeParse("https://hooks.slack.com/services/x/y/z")
        .success,
    ).toBe(true);
  });

  it("rejects a plain http URL", () => {
    expect(webhookUrlSchema.safeParse("http://example.com/hook").success).toBe(
      false,
    );
  });

  it("rejects localhost", () => {
    expect(webhookUrlSchema.safeParse("https://localhost/hook").success).toBe(
      false,
    );
  });

  it("rejects a loopback IP", () => {
    expect(webhookUrlSchema.safeParse("https://127.0.0.1/hook").success).toBe(
      false,
    );
  });

  it("rejects the cloud metadata address", () => {
    expect(
      webhookUrlSchema.safeParse("https://169.254.169.254/latest/meta-data")
        .success,
    ).toBe(false);
  });

  it("rejects a .internal hostname", () => {
    expect(
      webhookUrlSchema.safeParse("https://metadata.google.internal/hook")
        .success,
    ).toBe(false);
  });

  it("rejects a non-URL string", () => {
    expect(webhookUrlSchema.safeParse("not a url").success).toBe(false);
  });

  it("rejects the bracketed IPv6 loopback form, not just the bare one", () => {
    // Regression: new URL("https://[::1]/x").hostname is "[::1]" (brackets
    // kept), which a naive `BLOCKED_HOSTS.has("::1")` string check never
    // matches — confirmed bypassing validation before the isIP-based fix.
    expect(webhookUrlSchema.safeParse("https://[::1]/hook").success).toBe(
      false,
    );
  });

  it("rejects any other literal IPv6 address, not just known-bad ones", () => {
    expect(
      webhookUrlSchema.safeParse("https://[2001:db8::1]/hook").success,
    ).toBe(false);
  });

  it("rejects an IPv4-mapped IPv6 form of a blocked address", () => {
    expect(
      webhookUrlSchema.safeParse("https://[::ffff:169.254.169.254]/hook")
        .success,
    ).toBe(false);
  });
});

describe("buildWebhookPayload", () => {
  it("shapes a Slack payload for a hooks.slack.com URL", () => {
    const payload = buildWebhookPayload(
      "https://hooks.slack.com/services/x/y/z",
      EVENT,
    );
    expect(payload).toHaveProperty("text");
    expect(payload.text).toContain("ABC Coffee");
    expect(payload).not.toHaveProperty("content");
  });

  it("shapes a Discord payload for a discord.com webhook URL", () => {
    const payload = buildWebhookPayload(
      "https://discord.com/api/webhooks/123/abc",
      EVENT,
    );
    expect(payload).toHaveProperty("content");
    expect(payload.content).toContain("ABC Coffee");
  });

  it("falls back to a generic JSON payload for any other host", () => {
    const payload = buildWebhookPayload("https://hooks.example.com/x", EVENT);
    expect(payload.event).toBe("proposal_needs_action");
    expect(payload.supplierName).toBe("ABC Coffee");
    expect(payload.message).toContain("needs approval");
  });

  it("phrases a confirmation event distinctly from an approval event", () => {
    const payload = buildWebhookPayload("https://hooks.example.com/x", {
      ...EVENT,
      action: "confirmation",
    });
    expect(payload.message).toContain("needs confirmation");
  });

  it("says 'approved' when an approver's action moved an existing proposal into needing confirmation", () => {
    // Regression: the first live run of this notification (2026-10-07) read
    // "Mario proposed paying..." when Mario had actually just *approved* a
    // proposal Liam made — the verb was derived from `action` alone, which
    // can't distinguish this from the case below.
    const payload = buildWebhookPayload("https://hooks.example.com/x", {
      ...EVENT,
      actorName: "Mario",
      verb: "approved",
      action: "confirmation",
    });
    expect(payload.message).toContain("Mario approved paying");
    expect(payload.message).not.toContain("Mario proposed");
  });

  it("still says 'proposed' when someone with enough authority proposes directly into needing confirmation, no approval step involved", () => {
    // The other way a proposal reaches "needs confirmation": proposed
    // directly by an owner/accountant above the confirmation threshold but
    // within their own single-payment limit — nobody approved anything.
    const payload = buildWebhookPayload("https://hooks.example.com/x", {
      ...EVENT,
      actorName: "Mario",
      verb: "proposed",
      action: "confirmation",
    });
    expect(payload.message).toContain("Mario proposed paying");
    expect(payload.message).not.toContain("Mario approved");
  });
});
