# Small Business Financial Operator
Canteen × Circle × Arc hackathon

**CURRENT PHASE: 6**
*(I update this line. Work only on this phase.)*

## Start of every session

1. Read `BUILD_LOG.md` for progress, decisions and integration answers.
2. Read `docs/phases/phase-<CURRENT>.md` for this phase's tasks.
3. Read files in `docs/spec/` **only** when the phase file tells you to, or when a task needs them.

Don't read other phase files. Don't print large docs into the conversation.

## About me

Experienced web developer, **new to blockchain, Arc, Circle and on-chain agents**. When a blockchain term first comes up (wallet, private key, RPC, gas, ERC-20, signing, nonce, finality, faucet, explorer, x402, etc.), explain it in 1–3 practical sentences. No long tutorials unless I ask.

## How we work

For each phase: explain what we're building → give exact commands/code → I run/test → troubleshoot → verify → check the definition of done → summarize → update `BUILD_LOG.md` → **STOP** and wait for my confirmation. Never build multiple phases at once. Never assume code works because it was generated.

**Token efficiency:** read only the files you need; make targeted edits, not full rewrites; keep explanations short; ask me for specific error lines rather than full logs.

## Core principle

> **AI proposes. Rules authorize. Humans approve where required. Infrastructure executes.**

Enforced in code, not just docs.

```text
User → Finance Agent (proposes) → Policy Engine (decides) → Human approval/confirmation
     → Server-side re-check + execution → PaymentProvider → On-chain executor → Arc
```

## Security (non-negotiable)

The LLM may read data via tools, explain it, and create a **pending** payment proposal. It must **never** sign, access keys, send money, call a wallet, bypass the policy engine, approve/confirm payments, edit policies, or mark anything approved.

One server-side execution path submits payments. It loads the authoritative proposal, business state and policies; verifies role, approval and confirmation; re-runs the policy engine; checks the payment hasn't already executed; uses an idempotency key; calls the provider; persists the result. Never trust client flags, browser state, LLM output, hidden form values or cached decisions.

Secrets (`ARC_RPC_URL`, `ARC_PRIVATE_KEY`, `ANTHROPIC_API_KEY`) live in `.env.local`, server-side only: never logged, printed, sent to the client or committed. Never ask me to paste a private key into chat. Testnet-only disposable wallets.

## Integration boundary

**Claude owns:** app, UX, data model, synthetic data, finance engine, policy engine, roles, agent + tools, proposals, approval flow, repositories, mock provider, tests.

**Aomi / Canteen / Tameion advise on:** wallet architecture, signing, key management, on-chain agents, agent permissions, x402, Arc-specific execution, Circle wallet infrastructure.

At that boundary, STOP and say *"This is now an Aomi/Canteen/Tameion integration question"*, then give me the exact question to ask. Check `BUILD_LOG.md` first; the answer may already be there. **Current official docs win over anything in this repo's docs.** Never guess Arc, Circle or Aomi APIs, addresses or behaviour.

## Engineering standards

- **TypeScript strict.** No `any`; no `@ts-ignore` without a reason. ESLint + Prettier must pass.
- **Structure:** business logic in `lib/`, never in components or route handlers. Small single-purpose modules, clear names, no magic numbers, no dead code. Depend on interfaces, not implementations.
- **Validation:** zod at every boundary: API routes, server actions, env vars (fail fast at startup) and **every LLM tool call argument**.
- **Errors:** typed errors (e.g. `PolicyViolationError`, `PaymentProviderError`); never swallowed. Plain user-facing messages; details in server logs; secrets never logged.
- **Money:** decimal strings or integer cents, never floats.
- **Server-only:** key/RPC/payment code uses `import "server-only"`.
- **Tests:** Vitest. Policy + finance engines test-first where practical. Execution path must fail safely on rejected, unapproved, duplicate and tampered requests. No network in unit tests.
- **Git:** commit after each working step; conventional commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`); branch per phase, merged to `main` once confirmed. Never commit `.env*`.
- **CI:** GitHub Actions runs lint, typecheck and tests on every push/PR.
- **UI:** accessible (semantic HTML, labels, keyboard nav, contrast); loading/success/error states for every async action.
- **Docs:** keep `README.md` and `.env.example` current.
- Minimal, well-known dependencies. Least privilege everywhere.

If a practice would slow us down without real benefit at hackathon scale, say so rather than skipping it silently.

## Definition of done (every phase)

1. Feature works and I've verified it.
2. Lint, typecheck and tests pass.
3. New logic has tests.
4. No secrets committed.
5. Work committed with clear messages.
6. `BUILD_LOG.md` (and `README.md` if relevant) updated.

## Out of scope

Real bank integrations, payroll, tax, invoice OCR, mobile app, multi-business, production auth, smart-contract policy enforcement, unrestricted autonomous payments.

## Docs map

| File | Contains |
|---|---|
| `docs/spec/product.md` | Product, Mario's Coffee seed data, agent spec |
| `docs/spec/policy.md` | Roles, limits, decision rules, policy + finance engine contracts |
| `docs/spec/payments.md` | Payment provider, money/scale, Arc tooling, env vars, wallets |
| `docs/spec/brand.md` | Brand identity, per-company theming, voice & tone |
| `docs/phases/phase-N.md` | Tasks for each phase |
| `BUILD_LOG.md` | Progress, transactions, decisions, integration Q&A |
