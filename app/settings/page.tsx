import { AppHeader } from "@/components/app/app-header";
import { PolicyForm } from "@/components/settings/policy-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { policiesToForm } from "@/lib/policy/settings";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor, listActors } from "@/lib/session";

export default async function SettingsPage() {
  const repos = getRepositories();
  const [policies, actor] = await Promise.all([
    repos.policies.get(),
    getCurrentActor(),
  ]);

  const canEdit =
    actor.role === "owner" && policies.roles[actor.role].canEditPolicies;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <AppHeader
        businessName="Mario's Coffee"
        actors={listActors()}
        currentActor={actor}
        active="settings"
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Payment policies</h1>
          <p className="text-sm text-muted-foreground">
            Limits and reserves the policy engine enforces on every payment.
            {canEdit ? " Editable by the owner." : " Read-only for your role."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Limits &amp; reserves</CardTitle>
          </CardHeader>
          <CardContent>
            <PolicyForm values={policiesToForm(policies)} canEdit={canEdit} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
