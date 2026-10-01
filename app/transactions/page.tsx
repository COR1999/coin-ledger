import { AppHeader } from "@/components/app/app-header";
import { TransactionTable } from "@/components/dashboard/transaction-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_SCALE_LABEL } from "@/lib/config";
import { recentTransactions } from "@/lib/finance/dashboard";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor, listActors } from "@/lib/session";

export default async function TransactionsPage() {
  const repos = getRepositories();
  const [business, transactions, actor] = await Promise.all([
    repos.business.get(),
    repos.transactions.list(),
    getCurrentActor(),
  ]);

  const allTransactions = recentTransactions(transactions, Infinity);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <AppHeader
        businessName={business.name}
        actors={listActors()}
        currentActor={actor}
        active="transactions"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Transaction history</h1>
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
