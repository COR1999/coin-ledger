"use server";

import { waitlistSignupInputSchema } from "@/lib/domain/types";
import { mapZodFieldErrors } from "@/lib/forms/field-errors";
import { addWaitlistSignup } from "@/lib/repositories/waitlist";

export interface WaitlistResult {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<
    Record<"name" | "email" | "businessType" | "note", string>
  >;
}

export async function joinWaitlistAction(
  _prev: WaitlistResult,
  formData: FormData,
): Promise<WaitlistResult> {
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

  addWaitlistSignup(parsed.data);

  return {
    status: "success",
    message: "You're on the list — thanks for your interest.",
  };
}
