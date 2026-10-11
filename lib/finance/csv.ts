/**
 * Transaction history as CSV — the reconciliation format every accountant's
 * tooling (QuickBooks, Xero, a plain spreadsheet) already imports, so a real
 * business owner isn't stuck re-typing what the agent already recorded.
 * Pure string building, no I/O — the route handler owns the HTTP response.
 */
import { formatCents } from "@/lib/money";
import type { Transaction } from "@/lib/domain/types";
import { arcExplorerTxUrl } from "@/lib/config";

const COLUMNS = [
  "Date",
  "Description",
  "Category",
  "Amount (EUR)",
  "Tx Hash",
  "Explorer URL",
  "Decision Hash",
] as const;

/** RFC 4180 field escaping: quote and double-up internal quotes whenever a
 * field contains a comma, quote or newline — a supplier name or reason an
 * owner typed is untrusted input by the time it reaches here. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Spreadsheet apps execute a cell starting with one of these as a formula
 * (CSV injection, OWASP "CSV Injection"). */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** For free-text columns only: prefixes a leading formula trigger with `'`
 * so Excel/Sheets show it as text. Supplier names and payment reasons are
 * typed by users or written by the agent, so they can start with "=".
 * Not applied to the amount column, whose leading "-" is a real sign. */
function textField(value: string): string {
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

function toRow(values: readonly string[]): string {
  return values.map(csvField).join(",");
}

/** Builds the full CSV document, newest-first — same ordering convention as
 * the on-screen transaction table. CRLF line endings: the RFC 4180 default,
 * and what Excel expects without a BOM-sniffing fallback. */
export function transactionsToCsv(
  transactions: readonly Transaction[],
): string {
  const sorted = [...transactions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const rows = sorted.map((t) =>
    toRow([
      t.date,
      textField(t.description),
      textField(t.category),
      formatCents(t.amountCents),
      t.txHash ?? "",
      t.txHash ? arcExplorerTxUrl(t.txHash) : "",
      t.decisionHash ?? "",
    ]),
  );

  return [toRow(COLUMNS), ...rows].join("\r\n") + "\r\n";
}
