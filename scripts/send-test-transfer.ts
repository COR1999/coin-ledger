/**
 * Phase 5, step 1: one tiny, disposable transfer OUTSIDE the app flow, to
 * verify wallet, recipient, token, amount, gas, submission, confirmation,
 * tx hash and explorer link before any of this is wired into the real
 * PaymentProvider. Not part of lib/ — this is a throwaway verification
 * script, not app code.
 *
 * Usage: node --env-file=.env.local --experimental-strip-types scripts/send-test-transfer.ts
 */
import { randomUUID } from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const EURC_TOKEN_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const TEST_AMOUNT_EURC = "0.10";

// The arc-canteen-provisioned wallet from Phase 0 (already funded, already
// verified live) — reused here as a known-good disposable destination rather
// than provisioning a third wallet for a one-off test.
const DESTINATION_ADDRESS = "0xda9F9577a18530A9766C1Cc74ACd72A25dc33312";

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletAddress = process.env.CIRCLE_WALLET_ADDRESS;
  if (!apiKey || !entitySecret || !walletAddress) {
    throw new Error(
      "CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET and CIRCLE_WALLET_ADDRESS must be set",
    );
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  console.log(
    `Sending ${TEST_AMOUNT_EURC} EURC from ${walletAddress} to ${DESTINATION_ADDRESS} on ARC-TESTNET...`,
  );

  const idempotencyKey = randomUUID();
  const createResponse = await client.createTransaction({
    walletAddress,
    blockchain: "ARC-TESTNET",
    tokenAddress: EURC_TOKEN_ADDRESS,
    destinationAddress: DESTINATION_ADDRESS,
    amount: [TEST_AMOUNT_EURC],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    idempotencyKey,
  });

  const transactionId = createResponse.data?.id;
  if (!transactionId) {
    throw new Error(
      `No transaction id in response: ${JSON.stringify(createResponse.data)}`,
    );
  }
  console.log(`Transaction created: ${transactionId}`);

  const TERMINAL_STATES = new Set([
    "COMPLETE",
    "FAILED",
    "CANCELLED",
    "DENIED",
  ]);
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusResponse = await client.getTransaction({ id: transactionId });
    const tx = statusResponse.data?.transaction;
    console.log(`  poll ${attempt + 1}: state=${tx?.state}`);
    if (tx?.state && TERMINAL_STATES.has(tx.state)) {
      console.log(JSON.stringify(tx, null, 2));
      if (tx.state === "COMPLETE") {
        console.log(`\nConfirmed. Tx hash: ${tx.txHash}`);
        console.log(`Explorer: https://testnet.arcscan.app/tx/${tx.txHash}`);
      } else {
        console.error(`\nTransaction ended in state ${tx.state}.`);
        process.exit(1);
      }
      return;
    }
  }
  throw new Error("Timed out waiting for terminal transaction state");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
