import { AppHeader } from "@/components/app/app-header";
import { PauseToggle } from "@/components/settings/pause-toggle";
import { PolicyForm } from "@/components/settings/policy-form";
import { SupplierList } from "@/components/settings/supplier-list";
import { TransparencyToggle } from "@/components/settings/transparency-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEuros } from "@/lib/money";
import { policiesToForm } from "@/lib/policy/settings";
import {
  DEMO_WORKSPACE_ID,
  getRepositories,
} from "@/lib/repositories/singleton";
import { getCurrentActor, listActors } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export default async function SettingsPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const repos = getRepositories(workspaceId);
  const [business, policies, actors, actor, suppliers] = await Promise.all([
    repos.business.get(),
    repos.policies.get(),
    listActors(),
    getCurrentActor(),
    repos.suppliers.list(),
  ]);

  const canEdit =
    actor.role === "owner" && policies.roles[actor.role].canEditPolicies;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <AppHeader
        businessName={business.name}
        actors={actors}
        currentActor={actor}
        active="settings"
        isDemo={workspaceId === DEMO_WORKSPACE_ID}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="font-serif text-xl font-semibold">Payment policies</h1>
          <p className="text-sm text-muted-foreground">
            Limits and reserves the policy engine enforces on every payment.
            {canEdit ? " Editable by the owner." : " Read-only for your role."}
          </p>
        </div>

        <div className="mb-4">
          <PauseToggle paused={policies.paymentsPaused} canEdit={canEdit} />
        </div>

        <div className="mb-4">
          <TransparencyToggle
            enabled={policies.publicTransparencyEnabled}
            canEdit={canEdit}
            workspaceId={workspaceId}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Limits &amp; reserves</CardTitle>
          </CardHeader>
          <CardContent>
            <PolicyForm values={policiesToForm(policies)} canEdit={canEdit} />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierList
              suppliers={suppliers.map((s) => ({
                id: s.id,
                name: s.name,
                category: s.category,
                monthlyLimit: s.monthlyLimitCents
                  ? formatEuros(s.monthlyLimitCents)
                  : "none",
                employeeApproved: s.employeeApproved,
                blocked: s.blocked,
              }))}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
