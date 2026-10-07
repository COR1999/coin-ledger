"use server";

import { revalidatePath } from "next/cache";

import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { webhookUrlSchema } from "@/lib/notify/webhook";
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

export interface TransparencyToggleResult {
  status: "idle" | "success" | "error";
  message?: string;
  enabled?: boolean;
}

/**
 * Owner-only opt-in for the public "proof of operations" page
 * (app/t/[workspaceId]). Same pattern as togglePaymentsPausedAction: a
 * one-click toggle outside the batched policy form, because publishing or
 * un-publishing a business's payment history is a standalone decision, not
 * a limits edit.
 */
export async function toggleTransparencyAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: TransparencyToggleResult,
): Promise<TransparencyToggleResult> {
  const workspaceId = await getCurrentWorkspaceId();
  const repos = getRepositories(workspaceId);
  const [actor, policies] = await Promise.all([
    getCurrentActor(),
    repos.policies.get(),
  ]);

  if (actor.role !== "owner" || !policies.roles[actor.role].canEditPolicies) {
    return {
      status: "error",
      message: "Only the owner may publish or unpublish this page.",
    };
  }

  const nextEnabled = !policies.publicTransparencyEnabled;
  await repos.policies.set({
    ...policies,
    publicTransparencyEnabled: nextEnabled,
  });
  revalidatePath("/settings");
  revalidatePath(`/t/${workspaceId}`);

  return {
    status: "success",
    enabled: nextEnabled,
    message: nextEnabled
      ? "Published. Anyone with the link can now see your executed payments."
      : "Unpublished. The page no longer shows your payment history.",
  };
}

export interface NotificationWebhookResult {
  status: "idle" | "success" | "error";
  message?: string;
  webhookUrl?: string;
}

/**
 * Owner-only. An empty submitted value clears the webhook (disables
 * notifications) rather than being a validation error — "turn it off" has
 * to be as easy as "turn it on." A non-empty value is validated with the
 * same zod schema lib/notify/webhook.ts uses at the call site, so an
 * invalid or unsafe URL (see that schema's SSRF guard) is rejected here,
 * at the boundary, before it's ever stored.
 */
export async function updateNotificationWebhookAction(
  _prev: NotificationWebhookResult,
  formData: FormData,
): Promise<NotificationWebhookResult> {
  const repos = getRepositories(await getCurrentWorkspaceId());
  const [actor, policies] = await Promise.all([
    getCurrentActor(),
    repos.policies.get(),
  ]);

  if (actor.role !== "owner" || !policies.roles[actor.role].canEditPolicies) {
    return {
      status: "error",
      message: "Only the owner may change the notification webhook.",
    };
  }

  const raw = String(formData.get("webhookUrl") ?? "").trim();

  if (raw === "") {
    await repos.policies.set({
      ...policies,
      notificationWebhookUrl: undefined,
    });
    revalidatePath("/settings");
    return {
      status: "success",
      webhookUrl: "",
      message: "Notifications disabled.",
    };
  }

  const parsed = webhookUrlSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid webhook URL.",
    };
  }

  await repos.policies.set({
    ...policies,
    notificationWebhookUrl: parsed.data,
  });
  revalidatePath("/settings");

  return {
    status: "success",
    webhookUrl: parsed.data,
    message:
      "Saved. You'll get a notification whenever a payment needs approval or confirmation.",
  };
}
