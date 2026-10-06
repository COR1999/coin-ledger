"use server";

import { revalidatePath } from "next/cache";

import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export interface SupplierToggleResult {
  success: boolean;
  message: string;
  blocked?: boolean;
}

/**
 * Owner-only hard block/unblock for a supplier — stronger than the existing
 * employee-only approved-list restriction, and enforced at the policy
 * engine itself (packages/agent-policy-gate's Rule 0), not just hidden from
 * the UI: a blocked supplier is rejected for every role, including the
 * owner, the moment any proposal targeting them is evaluated or re-checked.
 * Authorization and the live supplier state are both re-read here, same
 * pattern as every other mutating action in this app — never trusted from
 * a client flag.
 */
export async function toggleSupplierBlockedAction(
  supplierId: string,
): Promise<SupplierToggleResult> {
  const repos = getRepositories(await getCurrentWorkspaceId());
  const [actor, policies, supplier] = await Promise.all([
    getCurrentActor(),
    repos.policies.get(),
    repos.suppliers.getById(supplierId),
  ]);

  if (actor.role !== "owner" || !policies.roles[actor.role].canEditPolicies) {
    return {
      success: false,
      message: "Only the owner may block or unblock a supplier.",
    };
  }

  if (!supplier) {
    return { success: false, message: "Supplier not found." };
  }

  const nextBlocked = !supplier.blocked;
  await repos.suppliers.update(supplierId, { blocked: nextBlocked });
  revalidatePath("/settings");
  revalidatePath("/chat");

  return {
    success: true,
    blocked: nextBlocked,
    message: nextBlocked
      ? `${supplier.name} is now blocked — no role can pay them until unblocked.`
      : `${supplier.name} is unblocked.`,
  };
}
