/**
 * Server-only entry point for the workspace store. Application code should
 * import from here, not from workspace-store.ts directly — the guard is the
 * point. (Tests import workspace-store.ts directly; see its own comment.)
 */
import "server-only";

export * from "@/lib/repositories/workspace-store";
