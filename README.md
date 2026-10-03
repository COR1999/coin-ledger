# Small Business Financial Operator

An on-chain financial operator for a small business, built for the
Canteen × Circle × Arc hackathon. An AI finance agent **proposes** payments; a
policy engine **decides**; a human **approves**; a single server-side path
**executes** on Arc testnet.

> **AI proposes. Rules authorize. Humans approve where required.
> Infrastructure executes.**

The LLM can read data and draft a _pending_ proposal. It can never sign, move
money, touch keys, or bypass the policy engine.

## Architecture

```
 User ──chat──▶ Finance Agent (Gemini, read-only tools + proposePayment)
                        │ proposes
                        ▼
                 Policy Engine ──decides──▶ allowed / needs_approval / rejected
                        │
                        ▼
         Human approval + confirmation (role-aware, /approvals)
                        │
                        ▼
      Server-side execution path (lib/payments/execute.ts)
      — re-loads the proposal + business state + policies
      — re-runs the policy engine (never trusts the earlier decision)
      — verifies approval/confirmation authority, blocks duplicates
      — submits via an idempotency key, polls for settlement
                        │
                        ▼
              PaymentProvider (mock, or Arc via Circle
              developer-controlled wallets)
                        │
                        ▼
                   Arc testnet
```

One rule holds everywhere: **nothing the client, the LLM, or a cached
decision says is trusted at execution time.** Every check in the execution
path is re-derived server-side from the authoritative proposal and the live
policy state.

### Layers

| Layer                    | Where                         | Responsibility                                                                                                  |
| ------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Finance + policy engines | `lib/finance/`, `lib/policy/` | Pure functions: safe-to-spend, forecast, policy decisions. No I/O.                                              |
| Repositories             | `lib/repositories/`           | Data-access interfaces + an in-memory implementation, seeded from `lib/data/seed.ts`. Swappable for a database. |
| Agent                    | `lib/agent/`                  | Gemini-backed finance agent. 5 read-only tools + `proposePayment`. Never signs or executes.                     |
| Execution                | `lib/payments/`               | `execute.ts` (the one path that moves money), `PaymentProvider` (mock / Arc), idempotency key derivation.       |
| UI                       | `app/`, `components/`         | Dashboard, chat, approvals, transaction history, policy settings. Role-aware server-side.                       |

## Stack

- Next.js (App Router) · TypeScript strict · Tailwind · shadcn/ui
- Google Gemini (`@google/genai`) for the finance agent
- zod for validation at every boundary · Vitest for tests
- Arc testnet via Circle developer-controlled wallets (`@circle-fin/developer-controlled-wallets`)

## Open source — what you can actually take from this repo

The whole repo is MIT-licensed and public, but one part was built specifically
to be lifted into _your own_ project, independent of everything else here:

**[`packages/agent-policy-gate/`](packages/agent-policy-gate/)** — a
standalone, zero-dependency TypeScript package. No React, no Next.js, no
database, no blockchain SDK. Two pure functions —
`evaluatePolicy` / `evaluateApproval` — that decide whether an AI
agent-proposed payment is **allowed**, **needs human approval**, or
**rejected**, and explain why.

**The selling point:** the moment an LLM agent can propose a payment, you
need something between "proposed" and "money moves" that the agent itself
has no path to bypass. That's not a feature of _this_ app — it's a generic
problem anyone wiring an AI agent into a payments flow on Arc, Circle, or
anywhere else will hit. This package is that layer, extracted so you don't
have to build it yourself or adopt this app's business logic, UI, Gemini
integration, or EUR-specific money handling to get it.

**How you'd use it in your own project:**

```ts
import { evaluatePolicy } from "agent-policy-gate"; // copy the folder, or npm install once published

const result = evaluatePolicy({
  amountCents: 24000,
  actor: { name: "Liam", role: "employee" },
  payee: {
    name: "ABC Coffee",
    approved: true,
    monthlyLimitCents: 80000,
    spentThisMonthCents: 46000,
  },
  businessState: {
    balanceCents,
    obligationsNext30DaysCents,
    todaySpentByActorCents,
    todaySpentByBusinessCents,
  },
  policies, // your own limits — see the package README
  formatAmount: (c) => `€${(c / 100).toFixed(2)}`, // your currency, not ours
});
// result.decision: "allowed" | "needs_approval" | "rejected"
```

Supply your own `Policies`/`Actor`/`Payee`/`formatAmount` — then, critically,
call it **again server-side immediately before executing**, exactly as this
app's own [`lib/payments/execute.ts`](lib/payments/execute.ts) does. Never
trust the agent's proposal, an earlier call's decision, or anything the
client sent — that's the one rule the whole architecture above is built on.

Full docs, the decision rules, and what it deliberately _doesn't_ do (no
execution, no wallet, not the only check) are in the package's own
[README](packages/agent-policy-gate/README.md) — including a direct
comparison against the closest prior art we found in the Arc ecosystem
(`arc-mirror-kit`), so the "this is actually different" claim is checkable,
not just asserted.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in values — see Environment below
npm run dev
```

Open http://localhost:3000. The role switcher in the header swaps between
Mario (owner), Aoife (accountant) and Liam (employee) — no real auth, a
cookie-backed session for demo purposes (see `lib/session.ts`).

## Environment

All variables are validated server-side at startup by `lib/env.ts`
(`lib/env.schema.ts` holds the zod schema). Secrets never reach the client
and are never committed; `.env*` is gitignored. Testnet uses disposable
wallets only.

| Variable                   | Required                       | Purpose                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`         | No (`mock` default)            | `mock` settles fake payments locally with a 10% simulated failure rate; `arc` executes real transfers on Arc testnet via Circle.                                                                                             |
| `GOOGLE_API_KEY`           | Yes                            | Gemini key for the finance agent.                                                                                                                                                                                            |
| `CHAT_RATE_LIMIT_PER_HOUR` | No (`10` default)              | Max chat messages per visitor (by IP) per hour on a public deployment — protects the shared Gemini free-tier quota. In-memory, so it's a soft limit on serverless platforms (see `lib/rate-limit.ts`), not a hard guarantee. |
| `CIRCLE_API_KEY`           | Only if `PAYMENT_PROVIDER=arc` | Circle developer-controlled wallets API key.                                                                                                                                                                                 |
| `CIRCLE_ENTITY_SECRET`     | Only if `PAYMENT_PROVIDER=arc` | Circle entity secret for wallet operations.                                                                                                                                                                                  |
| `CIRCLE_WALLET_ADDRESS`    | Only if `PAYMENT_PROVIDER=arc` | The business's Circle-managed wallet address (created via `scripts/create-arc-wallet.ts`).                                                                                                                                   |
| `ARC_RPC_URL`              | No                             | Arc RPC endpoint from `arc-canteen rpc-url`. Contains a Canteen token — treat as a secret. Not currently used for execution (Circle's API is called directly); kept for traction tracking.                                   |
| `ARC_PRIVATE_KEY`          | No                             | Unused — the confirmed architecture is Circle developer-controlled wallets, not a raw-key wallet. Left for reference only.                                                                                                   |
| `WAITLIST_ADMIN_SECRET`    | No                             | Gates `/admin/waitlist`. See **Admin** below.                                                                                                                                                                                |

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

## Testing

```bash
npm run test       # 87 tests: finance/policy engines, execution path,
                    # idempotency, repositories, env schema, branding
npm run typecheck
npm run lint
```

No network calls in unit tests — `PaymentProvider` is injected, so the
execution path and the mock provider are tested without hitting Arc or
Circle. `lib/payments/arc.ts` (the real Circle-backed provider) is a thin SDK
wrapper with no unit tests, by design — it has no injected client, so
covering it would mean either real network calls or a DI refactor not worth
it at hackathon scale; it was verified live instead (see Testnet transactions
in `BUILD_LOG.md`).

## Demo script

Switch roles with the header's role switcher. All three stories are also
recorded, with real testnet transaction hashes, in `BUILD_LOG.md`.

1. **Auto-approved payment.** As **Liam** (employee), open **Chat** and ask
   _"I need €30 of potatoes from Local Veg Supplier"_. Within his limits, so
   the agent proposes it, the policy engine auto-approves, and the server
   executes immediately — a tx hash and explorer link appear in the chat
   reply, and the payment shows up in **Transactions**.
2. **Needs approval + confirmation.** As **Liam**, ask _"Pay ABC Coffee
   €2,400"_ — above his limit and above the confirmation threshold. The
   agent proposes a pending payment. Switch to **Mario** (owner), open
   **Approvals**, approve it, then confirm it. The server re-checks policy
   and authority before executing.
3. **Rejected.** As **Mario**, ask _"Can I pay ABC Coffee €4,000?"_ — it
   breaches the single-payment limit, safe-to-spend, and the supplier's
   monthly cap. The agent explains all three reasons; no proposal is
   created, and nothing appears in **Approvals**.

Other things worth showing: a failed payment's **Retry** button on
**Approvals** (the mock provider fails ~10% of submissions); the full
history and explorer links on **Transactions**; and role-gated editing on
**Policies** (read-only for Liam, editable for Mario).

## Admin

**Viewing waitlist signups** (`/admin/waitlist`): visit the URL with
`?secret=<WAITLIST_ADMIN_SECRET>` appended, e.g.

```
https://financial-operator.vercel.app/admin/waitlist?secret=<your-secret>
```

The secret itself lives only in your deployment platform's env var store
(set via `vercel env add WAITLIST_ADMIN_SECRET production` / `preview`) —
it is never committed, never printed in logs, and not in this repo. If
you've lost it, generate a new one and overwrite it:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
vercel env rm WAITLIST_ADMIN_SECRET production
vercel env add WAITLIST_ADMIN_SECRET production   # paste the new value
```

**Why a secret, not a role check:** the page originally gated on
`actor.role === "owner"`, which looked right (Mario's workspace, owner
only) but wasn't — this app has no real authentication (out of scope by
design, see root `CLAUDE.md`), so "owner" is the _default_ identity for
any visitor with no cookie at all. On localhost that only ever meant the
one person running it; deployed publicly it meant anyone, with zero
steps — confirmed live via a cookieless `curl` request returning `200`
within minutes of the first deployment (see `BUILD_LOG.md`, 2026-10-03).
`WAITLIST_ADMIN_SECRET` is a real, out-of-band secret instead, compared
with a constant-time check so response timing can't leak it. Locally,
with the env var unset, the old role check still works unchanged — it's
only a real gate once deployed with the secret configured.

## Layout

- `app/` — routes and UI
- `lib/` — business logic (finance engine, policy engine, payments, agent, env)
- `docs/` — product, policy and payments specs; phase plans
- `BUILD_LOG.md` — progress, decisions, testnet transactions, integration Q&A
