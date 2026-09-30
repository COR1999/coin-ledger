# Small Business Financial Operator

An on-chain financial operator for a small business, built for the
Canteen × Circle × Arc hackathon. An AI finance agent **proposes** payments; a
policy engine **decides**; a human **approves**; a single server-side path
**executes** on Arc testnet.

> **AI proposes. Rules authorize. Humans approve where required.
> Infrastructure executes.**

The LLM can read data and draft a _pending_ proposal. It can never sign, move
money, touch keys, or bypass the policy engine.

## Stack

- Next.js (App Router) · TypeScript strict · Tailwind · shadcn/ui
- zod for validation at every boundary · Vitest for tests
- Arc testnet via the `arc-canteen` CLI (Circle L1; gas paid in USDC)

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script                 | Purpose                     |
| ---------------------- | --------------------------- |
| `npm run dev`          | Start the dev server        |
| `npm run build`        | Production build            |
| `npm run lint`         | ESLint                      |
| `npm run typecheck`    | `tsc --noEmit`              |
| `npm run test`         | Vitest (single run)         |
| `npm run test:watch`   | Vitest (watch)              |
| `npm run format`       | Prettier write              |
| `npm run format:check` | Prettier check (used in CI) |

## Environment

All variables are validated server-side at startup by `lib/env.ts`
(see `.env.example`). Secrets never reach the client and are never committed;
`.env*` is gitignored. Testnet uses disposable wallets only.

## Layout

- `app/` — routes and UI
- `lib/` — business logic (finance engine, policy engine, payments, env)
- `docs/` — product, policy and payments specs; phase plans
- `BUILD_LOG.md` — progress, decisions, testnet transactions, integration Q&A
