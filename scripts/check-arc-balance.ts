import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletId = process.env.CIRCLE_WALLET_ID;
  if (!apiKey || !entitySecret || !walletId) {
    throw new Error(
      "CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET and CIRCLE_WALLET_ID must be set",
    );
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  const response = await client.getWalletTokenBalance({ id: walletId });
  console.log(JSON.stringify(response.data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
