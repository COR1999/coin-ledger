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
export const envSchema = z.object({
  PAYMENT_PROVIDER: z.enum(["mock", "arc"]).default("mock"),
  // Contains a Canteen token → secret. Server-side only.
  ARC_RPC_URL: z.string().url().optional(),
  // Only present if the confirmed architecture uses a raw-key wallet.
  ARC_PRIVATE_KEY: z.string().min(1).optional(),
  GOOGLE_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse a raw environment record. Throws a readable, secret-free error listing
 * the offending variables when validation fails.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
