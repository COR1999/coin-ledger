# Payments & Arc spec

## Provider interface (`lib/payments/`)

Selected by `PAYMENT_PROVIDER=mock|arc`.

```ts
interface PaymentProvider {
  submit(req: {
    idempotencyKey: string;
    to: string;
    amount: string;             // decimal string
    currency: "EURC" | "USDC";
  }): Promise<{ paymentId: string; status: "pending" }>;

  getStatus(paymentId: string): Promise<{
    status: "pending" | "confirmed" | "failed";
    txHash?: string;
    failureReason?: string;
  }>;
}
```

`MockPaymentProvider` confirms after ~1s (Arc has ~1s finality, to be verified) and occasionally fails. The app must not care how blockchain execution happens.

## Money & demo scale

Internal ledger is **EUR**. On-chain settlement expected in **EURC** (to be verified). Test funds are small, so:

```ts
// lib/config.ts
export const ONCHAIN_SCALE = 1000; // TESTNET DEMO ONLY: €1,000 in app = 1 EURC on-chain
```

Every on-chain amount shows the label **"Testnet · 1:1,000 demo scale"**. Never silently convert €2,400 → 2.40 EURC. Before any real transfer, verify token, decimals, contract, network and gas from current docs.

## Canteen CLI

Known commands (verify with `arc-canteen --help` before use):
`login`, `wallet`, `rpc-url`, `rpc <method>`, `status`, `context sync`, `update-product`, `update-traction`, `submit-showcase`.

Docs: `arc-canteen context sync` clones to `~/.arc-canteen/context/`. Read **only** what's needed:
`connect-to-arc`, `contract-addresses`, `gas-and-fees`, `deterministic-finality`, `evm-compatibility`, `samples/arc-fintech`, `samples/arc-p2p-payments`. Never print the whole bundle.

Never run `update-*` or `submit-showcase` without my confirmation.

## Facts to verify (don't trust blindly)

- Arc testnet chain ID: 5042002
- Gas paid in USDC
- EURC supported natively on Arc testnet; available at faucet.circle.com
- EURC contract quoted as `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`. **Verify against `contract-addresses`.**
- Explorer: https://testnet.arcscan.app
- **Arc mainnet launched Sept 2026.** Confirm testnet is still live and still the right network.

## Env vars

```text
ARC_RPC_URL          # from `arc-canteen rpc-url`; contains my Canteen token, so treat as secret
ARC_PRIVATE_KEY      # only if the confirmed architecture uses a raw key wallet
PAYMENT_PROVIDER     # mock | arc
ANTHROPIC_API_KEY
```

Always send transactions through `ARC_RPC_URL` (likely how Canteen tracks activity, to be confirmed). An RPC endpoint gives node access; it does **not** authorize transactions. Don't assume a raw key wallet is the final architecture.

## Supplier wallet

ABC Coffee needs a receiving address: a separate disposable testnet wallet, credentials kept apart from the app's. Returning test funds to the business wallet is an explicit testnet-only script. We are not building custody.
