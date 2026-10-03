import { timingSafeEqual } from "node:crypto";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { listWaitlistSignups } from "@/lib/repositories/waitlist";
import { DEMO_WORKSPACE_ID } from "@/lib/repositories/singleton";
import { getCurrentActor } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";

/**
 * Read-only waitlist view (Phase 9's doc: "visible to you only ... a simple
 * authenticated list is enough"). No nav link — reachable by URL only.
 *
 * Gated on WAITLIST_ADMIN_SECRET (?secret= query param), not actor role.
 * The original design gated on "demo workspace's owner" — that looked right
 * (every onboarded workspace also has an actor with role "owner", so gating
 * on role alone would leak across workspaces) but was still wrong: there is
 * no real auth in this app (out of scope — see root CLAUDE.md), so "owner"
 * is the *default* identity for any visitor with no cookie at all. On
 * localhost that only ever meant Philip. Deployed publicly, it meant any
 * anonymous visitor — confirmed live via a cookieless curl request
 * returning 200, 2026-10-03. Fixed by requiring a real shared secret.
 *
 * Falls back to the old role check only when WAITLIST_ADMIN_SECRET isn't
 * set at all (local dev without it configured) — never on a deployment
 * where it's expected to be set. `notFound()` rather than a "forbidden"
 * message, so the route's existence isn't confirmed to someone who
 * shouldn't be looking for it.
 */
export default async function WaitlistAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  const [{ secret }, workspaceId, actor] = await Promise.all([
    searchParams,
    getCurrentWorkspaceId(),
    getCurrentActor(),
  ]);

  const authorized = env.WAITLIST_ADMIN_SECRET
    ? secretMatches(secret, env.WAITLIST_ADMIN_SECRET)
    : workspaceId === DEMO_WORKSPACE_ID && actor.role === "owner";

  if (!authorized) {
    notFound();
  }

  const signups = listWaitlistSignups();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Waitlist signups</h1>
          <p className="text-sm text-muted-foreground">
            {signups.length} {signups.length === 1 ? "signup" : "signups"} —
            in-memory, does not survive a server restart.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All signups</CardTitle>
          </CardHeader>
          <CardContent>
            {signups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No signups yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Business type</th>
                    <th className="py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {signups
                    .slice()
                    .reverse()
                    .map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{s.name}</td>
                        <td className="py-2 pr-3">{s.email}</td>
                        <td className="py-2 pr-3">{s.businessType}</td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(s.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
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
