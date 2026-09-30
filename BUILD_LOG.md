# Build log

## Status
Current phase: 0

## Shipped
- Phase 0 tooling — 2026-09-29 — app at repo root; Vitest/zod/Prettier/shadcn; CI (lint/format/typecheck/test); server-only env validation; arc-canteen 0.1.17 installed. Pending: `arc-canteen login` (→ tasks 8-11) and CI run on a remote.

## Testnet transactions
| Date | Purpose | Amount | Tx hash |
|---|---|---|---|

## Decisions
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
- **Still to verify post-login:** live block/chainId RPC calls, wallet address + balances, EURC availability/contract/decimals, finality. (Contract `0x89B5…D72a` in payments.md is UNVERIFIED — check `contract-addresses`.)

## Integration questions & answers
Sent to Aomi / Canteen / Tameion on: ____

| # | Question | Answer |
|---|---|---|
| 1 | Is Arc testnet still the right network for this hackathon now that mainnet is live? | |
| 2 | Wallet architecture: raw key, Circle developer-controlled wallets, or Aomi agent wallet? | |
| 3 | Should the executor be an Aomi agent? How does it receive an authorized request from our server? | |
| 4 | What signs transactions, and where do keys live? | |
| 5 | Confirm EURC + testnet contract address. | |
| 6 | Gas: USDC balance required, or a paymaster? | |
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
