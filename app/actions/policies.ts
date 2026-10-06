"use server";

import { revalidatePath } from "next/cache";

import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import {
  applyPolicyForm,
  policyFormSchema,
  type PolicyForm,
} from "@/lib/policy/settings";

export interface PolicyUpdateResult {
  status: "idle" | "success" | "error";
  message?: string;
  /** Per-field validation messages, keyed by form field name. */
  fieldErrors?: Partial<Record<keyof PolicyForm, string>>;
}

const FORM_FIELDS: (keyof PolicyForm)[] = [
  "minimumReserve",
  "businessDailyLimit",
  "confirmationThreshold",
  "ownerMaxSinglePayment",
  "accountantMaxSinglePayment",
  "accountantDailyLimit",
  "employeeMaxSinglePayment",
  "employeeDailyLimit",
];

/**
 * Update policies. Authorization is re-checked server-side against the current
 * actor and the live policy that grants editing — never against a client flag.
 * Input is validated with zod at this boundary before it reaches the engine.
 */
export async function updatePoliciesAction(
  _prev: PolicyUpdateResult,
  formData: FormData,
): Promise<PolicyUpdateResult> {
  const repos = getRepositories(await getCurrentWorkspaceId());
  const [actor, policies] = await Promise.all([
    getCurrentActor(),
    repos.policies.get(),
  ]);

  if (actor.role !== "owner" || !policies.roles[actor.role].canEditPolicies) {
    return {
      status: "error",
      message: "Only the owner may edit policies.",
    };
  }

  const raw = Object.fromEntries(
    FORM_FIELDS.map((f) => [f, formData.get(f) ?? ""]),
  );
  const parsed = policyFormSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof PolicyForm, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof PolicyForm | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Some values need fixing.",
      fieldErrors,
    };
  }

  const next = applyPolicyForm(policies, parsed.data);
  await repos.policies.set(next);
  revalidatePath("/settings");
  revalidatePath("/app");

  return { status: "success", message: "Policies updated." };
}

export interface PauseToggleResult {
  status: "idle" | "success" | "error";
  message?: string;
  paused?: boolean;
}

/**
 * Owner-only emergency circuit breaker, separate from the main policy form:
 * a pause is an immediate safety action someone reaches for in a hurry, not
 * a limits edit to fill in and remember to save — a dedicated one-click
 * toggle matches how this is actually used. Authorization and the live
 * policy state are both re-read here, same as updatePoliciesAction, never
 * trusted from a client flag.
 */
export async function togglePaymentsPausedAction(
  // Required by useActionState's calling convention even though this
  // action takes no form input to react to — its own live-read state is
  // what decides the next value, not the previous render's.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: PauseToggleResult,
): Promise<PauseToggleResult> {
  const repos = getRepositories(await getCurrentWorkspaceId());
  const [actor, policies] = await Promise.all([
    getCurrentActor(),
    repos.policies.get(),
  ]);

  if (actor.role !== "owner" || !policies.roles[actor.role].canEditPolicies) {
    return {
      status: "error",
      message: "Only the owner may pause or resume payments.",
    };
  }

  const nextPaused = !policies.paymentsPaused;
  await repos.policies.set({ ...policies, paymentsPaused: nextPaused });
  revalidatePath("/settings");
  revalidatePath("/app");
  revalidatePath("/approvals");
  revalidatePath("/chat");

  return {
    status: "success",
    paused: nextPaused,
    message: nextPaused
      ? "All payments are now paused. No proposal can execute until you resume."
      : "Payments resumed. Normal policy checks apply again.",
  };
}
