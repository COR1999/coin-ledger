import "server-only";

import { headers } from "next/headers";

/**
 * Client IP for the current request, from the first hop in X-Forwarded-For
 * (or "unknown" locally, where there's no proxy to set it). Shared helper for
 * any server action that needs a rate-limit key but — unlike a route handler —
 * has no NextRequest object of its own; app/api/chat/route.ts reads the same
 * header directly off its own request instead of using this.
 */
export async function getClientIp(): Promise<string> {
  const store = await headers();
  const forwardedFor = store.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
