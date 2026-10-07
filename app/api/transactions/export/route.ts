import { NextResponse } from "next/server";

import { transactionsToCsv } from "@/lib/finance/csv";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentWorkspaceId } from "@/lib/workspace";

/** Keeps a business's real name out of the filename's quoting/escaping
 * rules entirely — anything that isn't a safe filename character becomes
 * `-`, same conservative allowlist approach as a slug. */
function filenameSafe(name: string): string {
  return (
    name.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "business"
  );
}

/**
 * CSV export of a workspace's transaction history — no role restriction
 * beyond "some actor is signed in to this workspace," same visibility as
 * the /transactions page it sits next to, which already shows every
 * transaction to every role.
 */
export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  const repos = getRepositories(workspaceId);
  const [business, transactions] = await Promise.all([
    repos.business.get(),
    repos.transactions.list(),
  ]);

  const csv = transactionsToCsv(transactions);
  const filename = `${filenameSafe(business.name)}-transactions.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
