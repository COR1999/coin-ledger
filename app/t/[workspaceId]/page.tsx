import { notFound } from "next/navigation";

import { PublicTransactionList } from "@/components/transparency/public-transaction-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_SCALE_LABEL } from "@/lib/config";
import { recentTransactions } from "@/lib/finance/dashboard";
import { getRepositories, workspaceExists } from "@/lib/repositories/singleton";

/**
 * Public, no-login "proof of operations" page — the owner's opt-in answer to
 * "how do I know an AI agent actually followed the rules, not just that you
 * say it did." Reachable by anyone with the link, gated only on
 * `policies.publicTransparencyEnabled` (see lib/domain/types.ts's own
 * comment for the full privacy reasoning): shows real on-chain tx hashes and
 * each payment's decision-commitment hash, never balance or policy limits.
 *
 * `notFound()` for both "workspace doesn't exist" and "transparency is off"
 * — the same response either way, so a guessed workspace id can't be used
 * to probe which ids are real.
 */
export default async function PublicTransparencyPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  if (!(await workspaceExists(workspaceId))) {
    notFound();
  }

  const repos = getRepositories(workspaceId);
  const [business, policies, transactions] = await Promise.all([
    repos.business.get(),
    repos.policies.get(),
    repos.transactions.list(),
  ]);

  if (!policies.publicTransparencyEnabled) {
    notFound();
  }

  const executed = recentTransactions(transactions, Infinity).filter(
    (t) => t.txHash,
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Proof of operations
          </p>
          <h1 className="font-serif text-2xl font-semibold">{business.name}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Every payment below was approved by Coin Ledger&rsquo;s policy
            engine and settled on Arc testnet — {DEMO_SCALE_LABEL}. The tx hash
            links to the public explorer; the decision hash is a SHA-256
            commitment over the policy rules and the decision that authorized
            the payment, so it can be checked against tampering later. Neither
            figure is a blockchain attestation — this is a local,
            independently-checkable record, not a third-party proof.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Executed payments</CardTitle>
          </CardHeader>
          <CardContent>
            <PublicTransactionList transactions={executed} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
