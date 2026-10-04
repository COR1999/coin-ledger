"use server";

import { redirect } from "next/navigation";

import { mapZodFieldErrors } from "@/lib/forms/field-errors";
import { createWorkspace, onboardingInputSchema } from "@/lib/onboarding";
import { checkRateLimit } from "@/lib/rate-limit";
import { currentClientIp } from "@/lib/request-ip";
import { DEMO_WORKSPACE_ID } from "@/lib/repositories/singleton";
import { setCurrentWorkspaceId } from "@/lib/workspace";

export interface OnboardingResult {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: {
    businessName?: string;
    ownerName?: string;
    suppliers?: string;
  };
}

const SUPPLIER_ROWS = 3;

// Each submission permanently registers a new in-memory workspace (see
// lib/repositories/workspace-store.ts) with no eviction — unthrottled, a
// scripted loop could grow that Map without bound. Generous enough for a
// real visitor retrying the wizard a few times.
const ONBOARDING_RATE_LIMIT_PER_HOUR = 5;
const ONBOARDING_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Creates a visitor's own isolated workspace and lands them in it. Supplier
 * rows 2 and 3 are optional — a row counts only if its name is non-blank, so
 * the wizard can render three fixed rows without forcing all three.
 */
export async function createWorkspaceAction(
  _prev: OnboardingResult,
  formData: FormData,
): Promise<OnboardingResult> {
  const ip = await currentClientIp();
  const rateLimitResult = checkRateLimit(
    `onboarding:${ip}`,
    ONBOARDING_RATE_LIMIT_PER_HOUR,
    ONBOARDING_RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimitResult.allowed) {
    return {
      status: "error",
      message: "Too many attempts — please try again in a little while.",
    };
  }

  const businessName = String(formData.get("businessName") ?? "");
  const ownerName = String(formData.get("ownerName") ?? "");
  const suppliers = Array.from({ length: SUPPLIER_ROWS }, (_, i) => ({
    name: String(formData.get(`supplier${i + 1}Name`) ?? "").trim(),
    category: String(formData.get(`supplier${i + 1}Category`) ?? "").trim(),
  })).filter((s) => s.name.length > 0);

  const parsed = onboardingInputSchema.safeParse({
    businessName,
    ownerName,
    suppliers,
  });

  if (!parsed.success) {
    const fieldErrors = mapZodFieldErrors(parsed.error.issues, [
      "businessName",
      "ownerName",
      "suppliers",
    ] as const);
    // Override the array-level zod message with one that names the actual
    // requirement — "suppliers" has no per-field zod message worth showing.
    if (fieldErrors.suppliers) {
      fieldErrors.suppliers = "Add at least one supplier (name and category).";
    }
    return {
      status: "error",
      message: "Some values need fixing.",
      fieldErrors,
    };
  }

  const workspaceId = createWorkspace(parsed.data);
  await setCurrentWorkspaceId(workspaceId);
  redirect("/app");
}

/** Switches back to the canned demo business. */
export async function returnToDemoAction(): Promise<void> {
  await setCurrentWorkspaceId(DEMO_WORKSPACE_ID);
  redirect("/app");
}
