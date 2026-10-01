import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listWaitlistSignups } from "@/lib/repositories/waitlist";
import { DEMO_WORKSPACE_ID } from "@/lib/repositories/singleton";
import { getCurrentActor } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";

/**
 * Read-only waitlist view (Phase 9's doc: "visible to you only ... a simple
 * authenticated list is enough"). No nav link — reachable by URL only.
 *
 * Gated to the demo workspace's owner specifically, not "any owner": every
 * onboarded workspace (Phase 8) also has an actor with role "owner" — that's
 * the visitor who filled in the wizard, not the site operator. Gating on
 * role alone would let any visitor who onboarded their own business read
 * every other visitor's waitlist signups (name, email, business type).
 * `notFound()` rather than a "forbidden" message, so the route's existence
 * isn't confirmed to someone who shouldn't be looking for it.
 */
export default async function WaitlistAdminPage() {
  const [workspaceId, actor] = await Promise.all([
    getCurrentWorkspaceId(),
    getCurrentActor(),
  ]);

  if (workspaceId !== DEMO_WORKSPACE_ID || actor.role !== "owner") {
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
