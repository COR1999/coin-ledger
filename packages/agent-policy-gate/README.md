# agent-policy-gate

A pure, dependency-free TypeScript policy gate for letting an AI agent
**propose** payments without ever letting it **authorize** one.

Built while building [Small Business Financial Operator](../..) — a
Canteen × Circle × Arc hackathon project where an LLM agent reads a
business's live cash position and proposes payments to suppliers. The
interesting engineering problem wasn't "call an LLM" or "call a payment
API" — it was this: **the moment an agent can propose a payment, you need
something between "proposed" and "money moves" that the agent itself has
no path to bypass.** This package is that something, extracted so any
other Arc builder adding an AI agent to a payments flow can use it without
adopting this app's business logic, UI, or data model.

## What it does

Given a proposed payment, the actor proposing it, your current business
state, and your policies, `evaluatePolicy` decides one of three things —
**allowed**, **needs_approval**, or **rejected** — and returns the exact
reasons, so a rejection is never a bare "no."

```ts
import { evaluatePolicy, evaluateApproval } from "agent-policy-gate";

const result = evaluatePolicy({
  amountCents: 240_00,
  actor: { name: "Liam", role: "employee" },
  payee: {
    name: "ABC Coffee",
    approved: true,
    monthlyLimitCents: 800_00,
    spentThisMonthCents: 460_00,
  },
  businessState: {
    balanceCents: 1_842_00,
    obligationsNext30DaysCents: 973_00,
    todaySpentByActorCents: 0,
    todaySpentByBusinessCents: 0,
  },
  policies, // your Policies object — see src/types.ts
  formatAmount: (cents) => `€${(cents / 100).toFixed(2)}`,
});

// result.decision: "allowed" | "needs_approval" | "rejected"
// result.reasons: ["Exceeds Liam's €100.00 single-payment limit; requires owner approval"]
```

A second function, `evaluateApproval`, answers the separate question a
human approver's own role asks: _am I actually allowed to approve this
amount?_ — so "the agent proposed it" and "a human signed off" are both
independently checked, not conflated.

## What it deliberately does not do

- **It does not execute anything.** No wallet, no signing, no network call,
  no blockchain. It's a pure function: same input, same output, every time.
- **It is not the only check.** In the host app, this same function is
  re-run server-side immediately before a payment settles — not trusted
  from an earlier call, a cached decision, or anything the agent itself
  said. See [`lib/payments/execute.ts`](../../lib/payments/execute.ts) in
  the host app for that pattern.
- **It has no opinion on currency.** `formatAmount` is an injected
  function, not a hardcoded formatter — use it for EUR, USD, USDC,
  whatever.

## Role model

Ships with a 3-tier `owner` / `accountant` / `employee` hierarchy as a
documented convention, not a hard protocol requirement. Most small
businesses and agent systems have some version of this (an
owner-equivalent, a manager-equivalent, a worker-equivalent) — if yours
doesn't match, fork this package and adjust `Role` in `src/types.ts` plus
the escalation order in `evaluatePolicy` (rule 5 in `src/engine.ts`).

## Decision rules

Evaluated so that every applicable reason is reported, not just the first:

1. Any business-wide rule broken (safe-to-spend, business daily limit,
   payee's own monthly limit) → **rejected**
2. Amount above the owner's single-payment max (the hard ceiling) →
   **rejected**
3. The lowest-trust role paying a payee not on its approved list →
   **rejected**
4. Role exceeding its own daily limit → **rejected**
5. Actor's single-payment limit exceeded, but within the owner's max →
   **needs_approval**, naming the cheapest sufficient approver role
6. Otherwise → **allowed**
7. (`evaluateApproval`) An approver may only approve within their own
   approval limit; the lowest-trust role may never approve
8. `requiresConfirmation` = amount above a separate confirmation
   threshold — independent of the decision above, for a "yes but say it
   again" step on large amounts even when otherwise allowed

## Using it from this repo right now

The host app imports this package directly —
[`lib/policy/engine.ts`](../../lib/policy/engine.ts) re-exports from here
with its own currency (`formatEuros`) and domain types (`Supplier` ->
`Payee`) wired in. That's not a demo — it's the actual policy engine this
app's execution path calls. Run the host app's own test suite
(`npm test` from the repo root) and you're running this package's tests
too (`src/engine.test.ts`, included automatically).

## Using it standalone

Nothing in `src/` imports from outside this folder. Copy it into your own
project, or (once published) `npm install agent-policy-gate` — either
way, you only need to supply your own `Policies`, `Actor`, `Payee`, and
`formatAmount`.
