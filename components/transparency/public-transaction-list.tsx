import { arcExplorerTxUrl, formatOnChainAmount } from "@/lib/config";
import type { Transaction } from "@/lib/domain/types";
import { formatEurosDisplay } from "@/lib/money";

/** Truncated for display — the full hash is in the `title` tooltip and is
 * what an auditor would actually recompute and compare, not this preview. */
function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/**
 * The public-page counterpart to components/dashboard/transaction-table.tsx,
 * deliberately a separate component rather than a shared one: this one adds
 * the decision-hash column and is never passed anything beyond what
 * app/t/[workspaceId]/page.tsx already decided is safe to publish (executed,
 * on-chain transactions only — no balance, no policy limits, no pending
 * proposals).
 */
export function PublicTransactionList({
  transactions,
}: {
  transactions: Transaction[];
}) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No payments have settled on-chain yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {transactions.map((t) => (
        <li
          key={t.id}
          className="rounded-sm border border-t-2 border-t-accent p-3"
        >
          <div className="flex items-baseline gap-2">
            <p className="shrink-0 font-medium">{t.description}</p>
            <span
              aria-hidden
              className="mb-0.5 h-0 flex-1 border-b border-dotted border-muted-foreground/40"
            />
            <p className="shrink-0 text-right font-mono font-medium tabular-nums">
              {formatEurosDisplay(t.amountCents)}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.date} · {t.category}
          </p>
          <div className="mt-1.5 flex flex-col gap-0.5 text-xs">
            {t.txHash ? (
              <a
                href={arcExplorerTxUrl(t.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary underline underline-offset-2"
              >
                On-chain: {formatOnChainAmount(Math.abs(t.amountCents))}
              </a>
            ) : null}
            {t.decisionHash ? (
              <span
                className="font-mono text-muted-foreground"
                title={t.decisionHash}
              >
                Decision hash: {shortHash(t.decisionHash)}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
