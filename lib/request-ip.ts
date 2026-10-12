import "server-only";

import { headers } from "next/headers";

/**
 * Client IP for the current request, from the first hop in X-Forwarded-For
 * (or "unknown" locally, where there's no proxy to set it). Shared by every
 * rate-limited entry point, server actions and route handlers alike.
 */
export async function getClientIp(): Promise<string> {
  const store = await headers();
  const forwardedFor = store.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
