import { describe, expect, it } from "vitest";

import { buildWebhookPayload, webhookUrlSchema } from "./webhook";

const EVENT = {
  supplierName: "ABC Coffee",
  amountDisplay: "€2,400",
  reason: "Monthly beans delivery",
  proposedByName: "Liam",
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
});
