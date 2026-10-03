import { arcExplorerTxUrl, formatOnChainAmount } from "@/lib/config";
import type { Transaction } from "@/lib/domain/types";
import { formatEurosDisplay } from "@/lib/money";
import { cn } from "@/lib/utils";

export function TransactionTable({
  transactions,
}: {
  transactions: Transaction[];
}) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No transactions yet.</p>
    );
  }

  return (
    <>
      {/* Mobile: a stacked card per transaction. The table's 5 columns don't
          fit a narrow viewport even with overflow-x-auto scroll — nothing
          signals that scroll exists, so Amount and On-chain read as simply
          missing. Cards make every field visible without discovery. */}
      <ul className="space-y-3 sm:hidden">
        {transactions.map((t) => {
          const isIncome = t.amountCents >= 0;
          return (
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
                <p
                  className={cn(
                    "shrink-0 text-right font-mono font-medium tabular-nums",
                    isIncome
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground",
                  )}
                >
                  {isIncome ? "+" : ""}
                  {formatEurosDisplay(t.amountCents)}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.date} · {t.category}
              </p>
              <p className="mt-1.5 text-xs">
                {t.txHash ? (
                  <a
                    href={arcExplorerTxUrl(t.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary underline underline-offset-2"
                  >
                    On-chain: {formatOnChainAmount(Math.abs(t.amountCents))}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not on-chain</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Desktop/tablet: the full table. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Recent transactions</caption>
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">
                Date
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Description
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Category
              </th>
              <th scope="col" className="py-2 pl-4 text-right font-medium">
                Amount
              </th>
              <th scope="col" className="py-2 pl-4 text-left font-medium">
                On-chain
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-b [&>tr]:border-dotted [&>tr]:border-border">
            {transactions.map((t) => {
              const isIncome = t.amountCents >= 0;
              return (
                <tr key={t.id}>
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-muted-foreground">
                    {t.date}
                  </td>
                  <td className="py-2.5 pr-4">{t.description}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {t.category}
                  </td>
                  <td
                    className={cn(
                      "py-2.5 pl-4 text-right font-mono font-medium tabular-nums",
                      isIncome
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground",
                    )}
                  >
                    {isIncome ? "+" : ""}
                    {formatEurosDisplay(t.amountCents)}
                  </td>
                  <td className="py-2.5 pl-4 text-left font-mono text-xs">
                    {t.txHash ? (
                      <a
                        href={arcExplorerTxUrl(t.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                        title={`${formatOnChainAmount(Math.abs(t.amountCents))} — view on Arc explorer`}
                      >
                        {formatOnChainAmount(Math.abs(t.amountCents))}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
