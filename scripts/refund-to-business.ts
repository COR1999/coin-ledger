/**
 * Phase 5, step 4: explicit testnet-only script to sweep test EURC from the
 * demo supplier wallet back to the business wallet. Not custody — this only
 * works because the supplier wallet here is itself Circle-managed under our
 * own entity secret for demo purposes (see lib/data/seed.ts); it mirrors
 * returning test funds, nothing more. See docs/spec/payments.md § Supplier
 * wallet.
 *
 * EURC only, matching the app: execute.ts always settles in EURC, so the
 * supplier wallet never legitimately holds USDC beyond its own native gas
 * reserve, which this deliberately leaves alone. On Arc, native USDC (18
 * decimals) and the ERC-20 USDC interface (6 decimals) both resolve to the
 * same contract address — see BUILD_LOG.md's "USDC decimals gotcha" — so
 * anything address-matching USDC here would be ambiguous.
 *
 * Usage: node --env-file=.env.local --experimental-strip-types scripts/refund-to-business.ts
 */
import { randomUUID } from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

// Wallet created by:
//   node --env-file=.env.local --experimental-strip-types scripts/create-arc-wallet.ts financial-operator-supplier-demo
const SUPPLIER_WALLET_ID = "64116713-ce21-5fdf-bdcc-25d57fdb2f1b";
const SUPPLIER_WALLET_ADDRESS = "0xe6f53dfee8ac633ce62ab09675fd0d43408e8acb";

const EURC_TOKEN_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

const TERMINAL_STATES = new Set(["COMPLETE", "FAILED", "CANCELLED", "DENIED"]);

async function pollUntilTerminal(
  client: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  transactionId: string,
) {
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const response = await client.getTransaction({ id: transactionId });
    const tx = response.data?.transaction;
    if (tx?.state && TERMINAL_STATES.has(tx.state)) {
      return tx;
    }
  }
  throw new Error(`Timed out waiting for transaction ${transactionId}`);
}

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const businessWalletAddress = process.env.CIRCLE_WALLET_ADDRESS;
  if (!apiKey || !entitySecret || !businessWalletAddress) {
    throw new Error(
      "CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET and CIRCLE_WALLET_ADDRESS must be set",
    );
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  const balanceResponse = await client.getWalletTokenBalance({
    id: SUPPLIER_WALLET_ID,
  });
  const balances = balanceResponse.data?.tokenBalances ?? [];

  const eurcBalance = balances.find(
    (b) =>
      !b.token.isNative &&
      b.token.tokenAddress?.toLowerCase() === EURC_TOKEN_ADDRESS.toLowerCase(),
  );
  if (!eurcBalance || Number(eurcBalance.amount) <= 0) {
    console.log("No EURC balance on the supplier wallet, nothing to refund.");
    return;
  }

  console.log(
    `Refunding ${eurcBalance.amount} EURC from supplier (${SUPPLIER_WALLET_ADDRESS}) to business (${businessWalletAddress})...`,
  );
  const createResponse = await client.createTransaction({
    walletAddress: SUPPLIER_WALLET_ADDRESS,
    blockchain: "ARC-TESTNET",
    tokenAddress: EURC_TOKEN_ADDRESS,
    destinationAddress: businessWalletAddress,
    amount: [eurcBalance.amount],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    idempotencyKey: randomUUID(),
  });

  const transactionId = createResponse.data?.id;
  if (!transactionId) {
    throw new Error(
      `No transaction id in response: ${JSON.stringify(createResponse.data)}`,
    );
  }

  const tx = await pollUntilTerminal(client, transactionId);
  if (tx.state === "COMPLETE") {
    console.log(`Confirmed. Tx hash: ${tx.txHash}`);
    console.log(`Explorer: https://testnet.arcscan.app/tx/${tx.txHash}`);
  } else {
    console.error(`Ended in state ${tx.state}.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
