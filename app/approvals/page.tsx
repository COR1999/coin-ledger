import { AppHeader } from "@/components/app/app-header";
import { ProposalList } from "@/components/approvals/proposal-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { seedActors } from "@/lib/data/seed";
import { formatEurosDisplay } from "@/lib/money";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor, listActors } from "@/lib/session";

export default async function ApprovalsPage() {
  const repos = getRepositories();
  const [business, actor, proposals] = await Promise.all([
    repos.business.get(),
    getCurrentActor(),
    repos.proposals.list(),
  ]);

  const enriched = proposals
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((p) => {
      const proposer = seedActors.find((a) => a.id === p.proposedByActorId);
      const approver = p.approvedByActorId
        ? seedActors.find((a) => a.id === p.approvedByActorId)
        : null;
      return {
        id: p.id,
        supplierName: p.supplierId,
        amount: formatEurosDisplay(p.amountCents),
        reason: p.reason,
        proposedBy: proposer?.name ?? p.proposedByActorId,
        status: p.status,
        policyDecision: p.policyDecision,
        requiredApproverRole: p.requiredApproverRole ?? null,
        requiresConfirmation: p.requiresConfirmation,
        approvedBy: approver?.name ?? null,
      };
    });

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <AppHeader
        businessName={business.name}
        actors={listActors()}
        currentActor={actor}
        active="approvals"
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Payment proposals</h1>
          <p className="text-sm text-muted-foreground">
            Review, approve and confirm payments. You are signed in as{" "}
            {actor.name} ({actor.role}).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalList
              proposals={enriched}
              currentActorRole={actor.role}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
