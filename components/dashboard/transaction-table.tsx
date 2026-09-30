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
    <div className="overflow-x-auto">
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
          </tr>
        </thead>
        <tbody className="divide-y">
          {transactions.map((t) => {
            const isIncome = t.amountCents >= 0;
            return (
              <tr key={t.id}>
                <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
                  {t.date}
                </td>
                <td className="py-2.5 pr-4">{t.description}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {t.category}
                </td>
                <td
                  className={cn(
                    "py-2.5 pl-4 text-right font-medium tabular-nums",
                    isIncome
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground",
                  )}
                >
                  {isIncome ? "+" : ""}
                  {formatEurosDisplay(t.amountCents)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
