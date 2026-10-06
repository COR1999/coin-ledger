"use server";

import { waitlistSignupInputSchema } from "@/lib/domain/types";
import { env } from "@/lib/env";
import { mapZodFieldErrors } from "@/lib/forms/field-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { addWaitlistSignup } from "@/lib/repositories/waitlist-singleton";
import { getClientIp } from "@/lib/request-ip";

export interface WaitlistResult {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<
    Record<"name" | "email" | "businessType" | "note", string>
  >;
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function joinWaitlistAction(
  _prev: WaitlistResult,
  formData: FormData,
): Promise<WaitlistResult> {
  // Unlike /api/chat (which protects a shared paid-API quota), nothing
  // guarded this form at all — a script could flood it, and waitlist count
  // is the one real traction metric this build has (see BUILD_LOG.md on the
  // Tameion rubric's 30% traction weighting). Keyed with a prefix since
  // lib/rate-limit.ts's window map is a single shared store across every
  // caller — an unprefixed IP key here would double-count against the chat
  // route's own unprefixed IP key for the same visitor.
  const ip = await getClientIp();
  const rateLimitResult = checkRateLimit(
    `waitlist:${ip}`,
    env.WAITLIST_RATE_LIMIT_PER_HOUR,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimitResult.allowed) {
    return {
      status: "error",
      message: `Too many signups from this connection. Please try again in about ${Math.ceil(
        (rateLimitResult.retryAfterSeconds ?? 60) / 60,
      )} minute(s).`,
    };
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    businessType: String(formData.get("businessType") ?? ""),
    note: String(formData.get("note") ?? "") || undefined,
  };

  const parsed = waitlistSignupInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = mapZodFieldErrors(parsed.error.issues, [
      "name",
      "email",
      "businessType",
      "note",
    ] as const);
    return {
      status: "error",
      message: "Some values need fixing.",
      fieldErrors,
    };
  }

  await addWaitlistSignup(parsed.data);

  return {
    status: "success",
    message: "You're on the list — thanks for your interest.",
  };
}
