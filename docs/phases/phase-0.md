# Phase 0 — Environment + Arc verification

**Read:** `docs/spec/payments.md` (Canteen CLI, facts to verify, env vars).
**Do not:** implement payments, design the on-chain agent, or invent any Arc API.

**I'll do these myself to save tokens** (just give me the commands): `create-next-app`, `shadcn init`, package installs.

1. Check Node/npm, Git, current directory.
2. Initialize Git. Ensure `.gitignore` covers `.env*` before any secret exists.
3. Scaffold Next.js (App Router, TS strict, Tailwind). Add shadcn/ui, Vitest, zod, ESLint + Prettier.
4. Scripts: `lint`, `typecheck`, `test`, `format`. GitHub Actions CI running lint, typecheck, tests.
5. `README.md`, `.env.example`, env validation with zod.
6. `arc-canteen --help`: record the real commands in `BUILD_LOG.md`.
7. `arc-canteen context sync`: locate the relevant docs.
8. `arc-canteen rpc-url` → `.env.local` as `ARC_RPC_URL`.
9. **Testnet live check:** `arc-canteen rpc eth_blockNumber` and `arc-canteen rpc eth_chainId`.
10. `arc-canteen wallet`: address and balances.
11. From current docs, verify: chain ID, gas token, EURC availability + contract + decimals, faucet, explorer, finality.
12. Circle CLI only if the docs say we need it.
13. First commit; confirm CI passes.

## Report

```text
Environment          ✓/✗
Next.js + tooling    ✓/✗
CI                   ✓/✗
Canteen CLI          ✓/✗
Wallet               ✓/✗
RPC                  ✓/✗
Arc testnet live     ✓/✗
Testnet funds        ✓/✗ (USDC: …, EURC: …)
Relevant docs        ✓/✗

Verified network / tokens / gas / explorer / finality: …
Needs Canteen confirmation: …
```

Then STOP.
