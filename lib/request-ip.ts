/**
 * Client IP for Server Actions, which (unlike a route handler) have no
 * NextRequest to read headers from directly — next/headers is the only way
 * to reach the incoming request's headers here.
 *
 * Server-only: never import from a client component.
 */
import "server-only";

import { headers } from "next/headers";

/** First hop in X-Forwarded-For, or "unknown" when absent (e.g. local dev). */
export async function currentClientIp(): Promise<string> {
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
