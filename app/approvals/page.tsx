import { AppHeader } from "@/components/app/app-header";
import { PaymentsPausedBanner } from "@/components/app/payments-paused-banner";
import { ProposalList } from "@/components/approvals/proposal-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatOnChainAmount } from "@/lib/config";
import { formatEurosDisplay } from "@/lib/money";
import {
  DEMO_WORKSPACE_ID,
  getRepositories,
} from "@/lib/repositories/singleton";
import { getCurrentActor, listActors } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export default async function ApprovalsPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const repos = getRepositories(workspaceId);
  const [business, actors, actor, proposals, suppliers, policies] =
    await Promise.all([
      repos.business.get(),
      listActors(),
      getCurrentActor(),
      repos.proposals.list(),
      repos.suppliers.list(),
      repos.policies.get(),
    ]);

  const enriched = proposals
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((p) => {
      const proposer = actors.find((a) => a.id === p.proposedByActorId);
      const approver = p.approvedByActorId
        ? actors.find((a) => a.id === p.approvedByActorId)
        : null;
      const supplier = suppliers.find((s) => s.id === p.supplierId);
      return {
        id: p.id,
        // Falls back to the raw id only if the supplier record is somehow
        // gone (shouldn't happen — supplierId always comes from a real
        // supplier at proposal time) — never a blank label.
        supplierName: supplier?.name ?? p.supplierId,
        amount: formatEurosDisplay(p.amountCents),
        reason: p.reason,
        proposedBy: proposer?.name ?? p.proposedByActorId,
        status: p.status,
        policyDecision: p.policyDecision,
        requiredApproverRole: p.requiredApproverRole ?? null,
        requiresConfirmation: p.requiresConfirmation,
        approvedBy: approver?.name ?? null,
        txHash: p.txHash ?? null,
        onChainAmount: p.txHash ? formatOnChainAmount(p.amountCents) : null,
        failureReason: p.failureReason ?? null,
      };
    });

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <AppHeader
        businessName={business.name}
        actors={actors}
        currentActor={actor}
        active="approvals"
        isDemo={workspaceId === DEMO_WORKSPACE_ID}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {policies.paymentsPaused && <PaymentsPausedBanner />}
        <div className="mb-6">
          <h1 className="font-serif text-xl font-semibold">
            Payment proposals
          </h1>
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
            <ProposalList proposals={enriched} currentActorRole={actor.role} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
