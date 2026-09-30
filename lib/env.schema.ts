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
