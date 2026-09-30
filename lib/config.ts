/**
 * TESTNET DEMO ONLY: internal ledger is EUR; on-chain settlement is EURC.
 * Test funds are small, so amounts are scaled down for on-chain transfers —
 * never a silent 1:1 conversion. See docs/spec/payments.md § Money & demo scale.
 */
export const ONCHAIN_SCALE = 1000;

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
