import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

/**
 * Creates a new wallet on ARC-TESTNET. Pass a name as argv[2] to label it
 * (e.g. "financial-operator-supplier-abc-coffee"); defaults to the business
 * wallet's name for backward compatibility with the original Phase 5 run.
 *
 * Usage: node --env-file=.env.local --experimental-strip-types scripts/create-arc-wallet.ts [name]
 */
async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) {
    throw new Error("CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be set");
  }

  const name = process.argv[2] ?? "financial-operator-business";

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  const walletSetResponse = await client.createWalletSet({ name });
  console.log(
    "Wallet set response:",
    JSON.stringify(walletSetResponse.data, null, 2),
  );

  const walletSetId = walletSetResponse.data?.walletSet?.id;
  if (!walletSetId) throw new Error("No wallet set id returned");

  const walletsResponse = await client.createWallets({
    walletSetId,
    blockchains: ["ARC-TESTNET"],
    accountType: "EOA",
    count: 1,
  });
  console.log(
    "Wallets response:",
    JSON.stringify(walletsResponse.data, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
