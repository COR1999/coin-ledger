/**
 * Pure and framework-free, like the other unit-tested lib modules; the page
 * that calls it (app/admin/waitlist/page.tsx) is a server component.
 */
import { timingSafeEqual } from "node:crypto";

export interface WaitlistAdminAccessInput {
  /** WAITLIST_ADMIN_SECRET, if configured. */
  configuredSecret: string | undefined;
  /** The `?secret=` value the visitor supplied. */
  providedSecret: string | undefined;
  /** True for production builds (`next build`/`next start`, Vercel). */
  isProduction: boolean;
  /** Visitor is the demo workspace's owner (the default cookieless identity). */
  isDemoOwner: boolean;
}

/**
 * Whether a visitor may view /admin/waitlist. With a secret configured, only
 * a matching secret grants access. Without one, the demo-owner fallback is
 * allowed in development only: there is no real auth, so every cookieless
 * visitor is the demo owner, and a production deployment that forgot the
 * secret would otherwise expose every signup's email address to anyone.
 */
export function canViewWaitlistAdmin(input: WaitlistAdminAccessInput): boolean {
  if (input.configuredSecret) {
    return secretMatches(input.providedSecret, input.configuredSecret);
  }
  return !input.isProduction && input.isDemoOwner;
}

/** Constant-time comparison so response timing can't leak the secret. */
function secretMatches(
  provided: string | undefined,
  expected: string,
): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
