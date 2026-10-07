import { z } from "zod";

/**
 * Environment schema. Pure and side-effect free so it can be unit tested
 * without importing server-only runtime code.
 *
 * Secrets are optional in Phase 0 (the wallet/RPC architecture is not yet
 * confirmed and the app must boot for local dev before any secret exists).
 * They are validated for shape when present and tightened to required in the
 * phase that first consumes them.
 */
const baseEnvSchema = z.object({
  PAYMENT_PROVIDER: z.enum(["mock", "arc"]).default("mock"),
  // Contains a Canteen token → secret. Server-side only.
  ARC_RPC_URL: z.string().url().optional(),
  // Only present if the confirmed architecture uses a raw-key wallet.
  ARC_PRIVATE_KEY: z.string().min(1).optional(),
  GOOGLE_API_KEY: z.string().min(1),
  // Circle developer-controlled wallets (see BUILD_LOG.md Decisions).
  // Required once PAYMENT_PROVIDER=arc; optional otherwise so local dev
  // with the mock provider needs no Circle account.
  CIRCLE_API_KEY: z.string().min(1).optional(),
  CIRCLE_ENTITY_SECRET: z.string().min(1).optional(),
  CIRCLE_WALLET_ADDRESS: z.string().min(1).optional(),
  // Caps chat requests per IP per hour — protects the shared Gemini free-tier
  // quota from a single visitor exhausting it on a public demo deployment.
  CHAT_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(10),
  // Caps waitlist signups per IP per hour — the only thing stopping a script
  // from flooding the one traction metric this build actually has (see
  // docs/pitch.md / BUILD_LOG.md on the Tameion rubric's traction weighting).
  WAITLIST_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(5),
  // Gates /admin/waitlist. "Production auth" is explicitly out of scope for
  // this build (see root CLAUDE.md), but that can't mean real collected PII
  // (names, emails) sits behind no real check — the owner-role check it
  // originally used isn't one, since "owner" is the *default* identity for
  // any visitor with no cookie at all (see BUILD_LOG.md, 2026-10-03). Unset
  // in local dev is fine (the page still works via the old role check
  // there); required to actually view the page once deployed publicly.
  WAITLIST_ADMIN_SECRET: z.string().min(1).optional(),
  // Optional shared storage (Upstash Redis REST API — also what Vercel's own
  // KV integration provisions under the hood). Without these, workspaces and
  // waitlist signups live only in process memory (lib/repositories/workspace-
  // store.ts, lib/repositories/waitlist.ts), which does not survive a cold
  // start or a second serverless instance on Vercel — a confirmed live bug
  // (BUILD_LOG.md, 2026-10-03: a visitor's onboarded workspace reverted to
  // the demo within 4 seconds). Both optional and unset by default so local
  // dev and the current deployment keep working unchanged until configured.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Absolute origin used to build a clickable /approvals link inside an
  // owner's approval-notification webhook (lib/notify/webhook.ts) — a
  // relative path means nothing inside a Slack/Discord message. Optional:
  // falls back to Vercel's own VERCEL_URL at the call site when unset, and
  // the webhook feature itself is opt-in, so neither is required to boot.
  APP_BASE_URL: z.string().url().optional(),
});

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.PAYMENT_PROVIDER !== "arc") return;
  for (const key of [
    "CIRCLE_API_KEY",
    "CIRCLE_ENTITY_SECRET",
    "CIRCLE_WALLET_ADDRESS",
  ] as const) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required when PAYMENT_PROVIDER=arc`,
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse a raw environment record. Throws a readable, secret-free error listing
 * the offending variables when validation fails.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  // Empty placeholder lines (e.g. `ARC_PRIVATE_KEY=` in .env.local) mean
  // "unset", not "the empty string" — normalize before validating so an
  // unfilled optional var doesn't fail .min(1) instead of being treated as
  // absent.
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value === "" ? undefined : value,
    ]),
  );
  const result = envSchema.safeParse(normalized);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
