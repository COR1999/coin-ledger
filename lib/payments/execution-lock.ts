import "server-only";

import { getKvClientIfConfigured } from "@/lib/repositories/kv-client";
import type { ExecutionLock } from "./execute";

/**
 * The cross-instance execution lock for a workspace, backed by the same
 * Redis that stores the workspace. Undefined without Redis: state then lives
 * in one process's memory, so there is no other instance to coordinate with
 * and executePayment's in-process mutex is enough.
 */
export function getExecutionLock(
  workspaceId: string,
): ExecutionLock | undefined {
  const store = getKvClientIfConfigured();
  return store ? { store, scope: workspaceId } : undefined;
}
