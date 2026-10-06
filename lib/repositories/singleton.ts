/**
 * Server-only entry point for the workspace store. Application code should
 * import from here, not from workspace-store.ts directly — the guard is the
 * point. (Tests import workspace-store.ts directly; see its own comment.)
 *
 * Also the one place that wires the real Redis client factory into the pure
 * store, when UPSTASH_REDIS_REST_URL/TOKEN are configured — see
 * kv-client.ts and workspace-store.ts's own comments for why this injection
 * happens here rather than inside workspace-store.ts itself.
 */
import "server-only";

import { getKvClientIfConfigured } from "@/lib/repositories/kv-client";
import { setKvClientProvider } from "@/lib/repositories/workspace-store";

setKvClientProvider(getKvClientIfConfigured);

export * from "@/lib/repositories/workspace-store";
