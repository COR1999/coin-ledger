# Build log

## Status
Current phase: 1 (engines built; awaiting confirmation before merge)

## Shipped
- **Phase 1 — 2026-09-30 (branch `phase-1`, awaiting your confirmation)** — finance + policy engines and seeded in-memory data layer. `lib/money.ts` (integer cents, no floats), `lib/domain/types.ts` (+ zod proposal schema), `lib/data/seed.ts` (Mario's Coffee), `lib/finance/engine.ts`, `lib/policy/engine.ts`, `lib/repositories/` (interfaces + in-memory). **35 tests pass** incl. all 13 policy scenarios + finance figures (safe-to-spend €5,690, 30-day forecast €8,690); typecheck/lint/format clean. No UI, agent, or execution path yet (later phases). Not merged to `main`.
- **Phase 0 complete — 2026-09-30** — app at repo root; Vitest/zod/Prettier/shadcn; CI green on GitHub (`COR1999/financial-operator`, branch `phase-0`); server-only env validation; arc-canteen logged in, testnet verified live (5042002, <1s finality), wallet funded $5 USDC, EURC contract + decimals + gas confirmed from synced docs.

## Testnet transactions
| Date | Purpose | Amount | Tx hash |
|---|---|---|---|

## Decisions
- **Employee daily limit only caps self-authorizable payments** (Phase 1). A payment within the actor's single-payment limit counts against their daily cap; a larger payment escalates to approval instead, where a different authority answers, so the requester's daily cap does not reject it. This reconciles scenario 3 (Liam €2,400 → needs_approval) with scenario 9 (Liam €30 after €280 → rejected). Generalised to any role with a daily limit. (2026-09-30)
- **Policy reasons are collected, not short-circuited** (Phase 1) — a payment breaking several rules reports all applicable reasons; tests assert the documented reason is present, not that it is the only one. (2026-09-30)
- **Money is integer cents end to end** (`lib/money.ts`); decimal strings only at boundaries. `eur()` builder keeps float literals out of seed/policy data. (2026-09-30)
- **Balance stored on the business, not derived from transactions** (Phase 1) — seed gives the authoritative €18,420; the transaction history is illustrative for now, to be expanded in the dashboard phase. (2026-09-30)
- Added a `@/*` alias to `vitest.config.ts` mirroring `tsconfig.json` so tests resolve the same import paths as the app. (2026-09-30)
- App moved from `coin-ledger/` subfolder to repo root — matches CLAUDE.md paths (`lib/`, `app/`), simpler scripts/CI. (2026-09-29)
- Git repo at project root on branch `phase-0`; docs + app version-controlled together. (2026-09-29)
- `arc-canteen` installed via `pip install arc-canteen` (v0.1.17) — `uv`/`pipx` not present on this machine. (2026-09-29)
- Env validation split: `lib/env.schema.ts` (pure, unit-tested) + `lib/env.ts` (`import "server-only"` + parse) so the schema is testable without loading server-only code. (2026-09-29)

## Environment notes
- **PATH gap:** pip installed `arc-canteen.exe` to `…\PythonSoftwareFoundation.Python.3.11…\LocalCache\local-packages\Python311\Scripts`, which is **not on PATH**. Until fixed, invoke via full path. Fix: add that Scripts dir to PATH, or reinstall with `uv tool install arc-canteen` (lands in `~/.local/bin`, already on PATH).
- `arc-canteen login` (GitHub auth) is interactive and must be run by the human; the agent cannot complete it. Login provisions the wallet ($5 USDC), RPC token, and context bundle.

## Verified facts (from Canteen Bento Box page + CLI, 2026-09-29)
- Chain ID **5042002**; native gas token is **USDC**.
- RPC host: `https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>` (exact URL via `arc-canteen rpc-url`; token = secret).
- Explorer: https://testnet.arcscan.app
- Docs bundle synced from `the-canteen-dev/context-arc` to `~/.arc-canteen/context/` via `arc-canteen context sync`.

### Verified post-login against live CLI + synced docs (2026-09-30)
- **Testnet live:** `eth_blockNumber` returned `0x3db1942` (advancing); `eth_chainId` = `0x4cef52` = **5042002** ✓.
- **App wallet:** `0xda9F9577a18530A9766C1Cc74ACd72A25dc33312`, funded **$5 testnet USDC**. Private key lives in arc-canteen's config only; app does not hold it (ARC_PRIVATE_KEY unset — architecture is an open integration question).
- **Gas:** all fees denominated in **USDC** (native gas token), EWMA base-fee smoothing → stable costs. (`gas-and-fees.md`)
- **EURC:** contract **`0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`**, **6 decimals**, natively supported; faucet at faucet.circle.com. Confirms the address quoted in payments.md ✓. (`contract-addresses.md`)
- **⚠️ USDC decimals gotcha:** native USDC gas token uses **18 decimals**, but the USDC ERC-20 interface (`0x3600…0000`) uses **6 decimals**. EURC uses 6. Always call `decimals()`; never mix. Relevant to `lib/config.ts` money handling.
- **Finality:** deterministic, **under one second**, irreversible (`deterministic-finality.md`) — confirms the ~1s assumption in payments.md's MockPaymentProvider.
- **RPC in `.env.local`:** `ARC_RPC_URL` written (host `rpc.testnet.arc-node.thecanteenapp.com`; token redacted, file gitignored).
- **Testnet funds:** USDC $5 ✓ · EURC 0 (request from faucet.circle.com when needed).

## Integration questions & answers
Sent to Aomi / Canteen / Tameion on: ____

| # | Question | Answer |
|---|---|---|
| 1 | Is Arc testnet still the right network for this hackathon now that mainnet is live? | Tooling verified: arc-canteen provisions testnet (5042002) and it's live (block advancing). Treating testnet as correct; still worth a Canteen nod. |
| 2 | Wallet architecture: raw key, Circle developer-controlled wallets, or Aomi agent wallet? | |
| 3 | Should the executor be an Aomi agent? How does it receive an authorized request from our server? | |
| 4 | What signs transactions, and where do keys live? | |
| 5 | Confirm EURC + testnet contract address. | Verified from `contract-addresses.md`: EURC `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`, 6 decimals, native on Arc testnet. |
| 6 | Gas: USDC balance required, or a paymaster? | Gas is paid in native USDC (wallet funded $5). Whether to use a paymaster/account-abstraction still open — see `account-abstraction.md`. |
| 7 | Recommended way to monitor transaction status? | |
| 8 | Are txs through our `arc-canteen rpc-url` automatically tracked? | |
| 9 | Recommended use of `update-product`, `update-traction`, `submit-showcase`? | |

## CLI commands (from `arc-canteen --help`, v0.1.17)
| Command | Purpose |
|---|---|
| `login` / `logout` | GitHub auth + profile setup / clear credentials |
| `wallet` | Show (or create) funded testnet wallet |
| `rpc-url` | Print JSON-RPC URL with server token embedded (secret) |
| `shell-init` | Print rc snippet that auto-loads `$RPC` |
| `rotate-rpc-key` | Mint fresh RPC/server token |
| `rpc <method>` | Make a JSON-RPC call to Arc |
| `status` | Show dashboard |
| `push` | Push queued local events to server |
| `context` | Print docs + sample paths for agent context |
| `context sync` | Clone full docs bundle to `~/.arc-canteen/context/` |
| `ls` / `history` | List updates (traction + product) |
| `update traction\|product` | Submit updates (also `update-traction`, `update-product`) |
| `profile` / `profile-edit` | View/edit profile |
| `submit-showcase` | Submit project to Arc Showcase |
| `submit-puzzle` | Submit puzzle answer |

⚠️ Never run `update-*`, `submit-showcase`, or `submit-puzzle` without explicit confirmation.
