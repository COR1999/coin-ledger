import type { z } from "zod";

/**
 * Maps zod issues to a flat field-name -> first-message record, for forms
 * that show one error per field. Shared by every server action that
 * zod-validates a flat object (onboarding, waitlist, policies) — each
 * previously hand-rolled this loop with only its own field-name set
 * differing.
 *
 * `fields` scopes which top-level keys are rendered as field errors (e.g. an
 * array-level issue like "suppliers" needs its own fallback message, not a
 * zod path lookup) — callers that need a custom message for a given key
 * should overwrite `result[key]` after calling this.
 */
export function mapZodFieldErrors<K extends string>(
  issues: z.ZodIssue[],
  fields: readonly K[],
): Partial<Record<K, string>> {
  const result: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (
      typeof key === "string" &&
      (fields as readonly string[]).includes(key)
    ) {
      const typedKey = key as K;
      result[typedKey] ??= issue.message;
    }
  }
  return result;
}
