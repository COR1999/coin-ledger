/**
 * Process-wide repositories singleton. The in-memory factory seeds fresh state
 * on every call, so mutations (e.g. an owner editing policies) would not survive
 * across requests. Holding one instance for the server process keeps those edits
 * visible until restart — adequate for the hackathon; a database behind the same
 * interfaces would replace this without touching callers.
 *
 * Server-only: never import from a client component.
 */
import "server-only";

import { createInMemoryRepositories } from "@/lib/repositories/in-memory";
import type { Repositories } from "@/lib/repositories/types";

declare global {
  var __financialOperatorRepos: Repositories | undefined;
}

/** Reuse a single instance across hot reloads in development. */
export function getRepositories(): Repositories {
  globalThis.__financialOperatorRepos ??= createInMemoryRepositories();
  return globalThis.__financialOperatorRepos;
}
