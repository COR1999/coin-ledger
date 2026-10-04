"use server";

import { waitlistSignupInputSchema } from "@/lib/domain/types";
import { mapZodFieldErrors } from "@/lib/forms/field-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { currentClientIp } from "@/lib/request-ip";
import { getWaitlistStore } from "@/lib/repositories/waitlist-store";
import { WaitlistProviderError } from "@/lib/repositories/waitlist-resend";

export interface WaitlistResult {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<
    Record<"name" | "email" | "businessType" | "note", string>
  >;
}

// This form is public and, once Resend is wired in, each submission is a
// real external API call — generous enough for a real visitor to retype a
// typo'd email a few times, tight enough to block a scripted loop from
// spamming Resend's contact list or quota.
const WAITLIST_RATE_LIMIT_PER_HOUR = 5;
const WAITLIST_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function joinWaitlistAction(
  _prev: WaitlistResult,
  formData: FormData,
): Promise<WaitlistResult> {
  const ip = await currentClientIp();
  const rateLimitResult = checkRateLimit(
    `waitlist:${ip}`,
    WAITLIST_RATE_LIMIT_PER_HOUR,
    WAITLIST_RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimitResult.allowed) {
    return {
      status: "error",
      message: "Too many attempts — please try again in a little while.",
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

  try {
    await getWaitlistStore().add(parsed.data);
  } catch (err) {
    if (err instanceof WaitlistProviderError) {
      return {
        status: "error",
        message: "Couldn't save your signup — please try again.",
      };
    }
    throw err;
  }

  return {
    status: "success",
    message: "You're on the list — thanks for your interest.",
  };
}
