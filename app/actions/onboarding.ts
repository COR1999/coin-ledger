"use server";

import { redirect } from "next/navigation";

import { createWorkspace, onboardingInputSchema } from "@/lib/onboarding";
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

/**
 * Creates a visitor's own isolated workspace and lands them in it. Supplier
 * rows 2 and 3 are optional — a row counts only if its name is non-blank, so
 * the wizard can render three fixed rows without forcing all three.
 */
export async function createWorkspaceAction(
  _prev: OnboardingResult,
  formData: FormData,
): Promise<OnboardingResult> {
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
    const fieldErrors: OnboardingResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "businessName" || key === "ownerName") {
        fieldErrors[key] ??= issue.message;
      } else if (key === "suppliers") {
        fieldErrors.suppliers ??=
          "Add at least one supplier (name and category).";
      }
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
