import { AppHeader } from "@/components/app/app-header";
import { TransactionTable } from "@/components/dashboard/transaction-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_SCALE_LABEL } from "@/lib/config";
import { recentTransactions } from "@/lib/finance/dashboard";
import {
  DEMO_WORKSPACE_ID,
  getRepositories,
} from "@/lib/repositories/singleton";
import { getCurrentActor, listActors } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export default async function TransactionsPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const repos = getRepositories(workspaceId);
  const [business, transactions, actors, actor] = await Promise.all([
    repos.business.get(),
    repos.transactions.list(),
    listActors(),
    getCurrentActor(),
  ]);

  const allTransactions = recentTransactions(transactions, Infinity);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <AppHeader
        businessName={business.name}
        actors={actors}
        currentActor={actor}
        active="transactions"
        isDemo={workspaceId === DEMO_WORKSPACE_ID}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="font-serif text-xl font-semibold">
            Transaction history
          </h1>
          <p className="text-sm text-muted-foreground">
            Every recorded transaction for {business.name}. Payments settled on
            Arc testnet show their on-chain amount, linked to the explorer —{" "}
            {DEMO_SCALE_LABEL}.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionTable transactions={allTransactions} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
