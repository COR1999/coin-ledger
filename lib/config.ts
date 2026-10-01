import { formatCents } from "@/lib/money";

/**
 * TESTNET DEMO ONLY: internal ledger is EUR; on-chain settlement is EURC.
 * Test funds are small, so amounts are scaled down for on-chain transfers —
 * never a silent 1:1 conversion. See docs/spec/payments.md § Money & demo scale.
 */
export const ONCHAIN_SCALE = 1000;

/** Label shown next to every on-chain amount, per docs/spec/payments.md. */
export const DEMO_SCALE_LABEL = `Testnet · 1:${ONCHAIN_SCALE.toLocaleString("en-IE")} demo scale`;

/** €2,400 (as "2400.00") at 1:1,000 scale -> "2.4" EURC. */
export function toOnChainAmount(eurDecimal: string): string {
  const eurValue = Number(eurDecimal);
  if (!Number.isFinite(eurValue) || eurValue < 0) {
    throw new Error(
      `Invalid EUR amount for on-chain conversion: "${eurDecimal}"`,
    );
  }
  return (eurValue / ONCHAIN_SCALE).toString();
}

/** €2,400 (as integer cents) -> "2.4 EURC", for display next to a tx hash. */
export function formatOnChainAmount(amountCents: number): string {
  return `${toOnChainAmount(formatCents(amountCents))} EURC`;
}

/** Arc testnet explorer link for a confirmed transaction hash. */
export function arcExplorerTxUrl(txHash: string): string {
  return `https://testnet.arcscan.app/tx/${txHash}`;
}
