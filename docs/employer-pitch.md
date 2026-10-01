# Pitching this project to an employer

Reference doc, not a build phase — material for your resume, LinkedIn, and
interviews. Different audience from `docs/pitch.md` (that one is for
small-business users and hackathon judges; this one is for someone deciding
whether to hire you). Every number here is pulled from `BUILD_LOG.md` —
nothing invented. If a line here ever drifts from what BUILD_LOG actually
shows, trust BUILD_LOG and fix this file, not the other way round.

## The 10-second hook

> "I built an AI agent that proposes real financial payments, a policy
> engine that decides whether they're allowed, and a human approval step
> before anything moves — then wired the execution path to actually settle
> on a live blockchain, not a simulation."

## The 30-second version

A small-business financial operator: an LLM agent reads live cash position
and policy, proposes a payment, and a deterministic policy engine decides
allowed / needs-approval / rejected. Nothing executes on the agent's say-so
— one server-side path re-verifies everything (role, approval, policy,
duplicate-submission) before it ever calls a payment provider. That
provider is real: Circle developer-controlled wallets, settling on Arc
testnet, with four real, publicly verifiable transactions on
`testnet.arcscan.app` to prove it isn't a mock. 113 automated tests,
TypeScript strict, CI green, zod validation at every boundary.

## What this actually proves about you (not adjectives — evidence)

| Claim | Evidence |
|---|---|
| You design for a real security boundary, not just features | The LLM can *propose*; it cannot sign, approve, or touch a key. Enforced server-side (`lib/payments/execute.ts`), re-verified on every execution — not trusted from the UI or the agent's own output. |
| You ship against a live, unfamiliar external system, not just mocks | 4 real Arc testnet transactions, each with a tx hash you can hand an interviewer right now to click and verify independently. |
| You debug by reading primary sources, not guessing | Aomi's wallet-delegation model was evaluated by reading Aomi's own docs directly, found it would duplicate an approval gate the app already had, and documented *why* it was deprioritized — not just "didn't use it." |
| You find and fix real bugs under your own steam, not just what's asked | Idempotency key collision after dev-server restarts (Circle silently replayed a stale tx instead of executing a new payment) — found by actually running it against the real provider, root-caused, fixed, verified. |
| You route around real-world constraints without stalling | Google's Gemini free-tier quota (20 req/day, per-model) was exhausted mid-demo. Queried the live model list via the API, confirmed sibling models had untouched quota, and switched — a working stop-gap in minutes, explicitly logged as a stop-gap, not disguised as a considered choice. |
| You write tests that encode real failure modes, not vanity coverage | Execution path has explicit tests for rejected, unapproved, duplicate, and tampered requests — the actual threat model, not just the happy path. |
| You extend an existing architecture instead of bolting on side paths | Added multi-tenant workspace isolation (bring-your-own-business onboarding) by extending the existing `Repositories` interface with two new methods, not a parallel code path — every consumer (execution, agent tools, every page) got the fix for free. |

## Resume bullets (pick 2–3 that fit the role)

- Built a full-stack AI-agent fintech app (Next.js, TypeScript strict,
  Google Gemini tool-calling) with a server-enforced policy engine and a
  real blockchain settlement path (Circle wallets on Arc testnet) — 113
  automated tests, CI-gated, zero client-trusted authorization decisions.
- Designed and shipped the single server-side execution path for a
  payments system: re-verifies role, approval, policy, and idempotency on
  every call, independent of what the client or an LLM agent assumed.
- Debugged and fixed a live idempotency-key collision against a real
  payment provider's API (Circle), root-caused to an in-memory counter
  reset, verified with a real on-chain transaction after the fix.
- Evaluated a third-party wallet-delegation architecture (Aomi) by reading
  primary docs rather than assuming, documented the decision to deprioritize
  it with the specific technical reason, in a build log read by the next
  engineer (or session) on the project.

## LinkedIn-length version

> Spent a hackathon building a small-business "financial operator": an AI
> agent proposes payments, a policy engine decides, a human approves, and
> one server-side path executes — settling for real on Arc testnet via
> Circle's wallet infrastructure. Four real testnet transactions, 113
> tests, strict TypeScript, CI green end to end. The interesting part
> wasn't the AI — it was making sure the AI could never actually move
> money on its own.

## STAR answer: "Tell me about a project you're proud of"

**Situation:** Hackathon brief: build something on Arc (Circle's L1,
gas paid in stablecoin) that people would actually use — not just a demo
that touches the chain once for show.

**Task:** The hard part wasn't "call an LLM" or "call a blockchain API" —
it was making an AI agent genuinely safe to let near real payments, when
the whole point of the product is that it proposes payments.

**Action:** Split the system into four layers with one rule holding
everywhere: nothing the client, the LLM, or a cached decision says is
trusted at execution time. The agent only ever calls a `proposePayment`
tool — it has no path to a signer. A policy engine makes allowed /
needs-approval / rejected decisions from live state (safe-to-spend,
per-role limits, per-supplier caps). A single execution function re-loads
the authoritative proposal and re-runs every check — role, approval,
confirmation, duplicate-submission via idempotency key — immediately
before calling the real payment provider. I verified it end to end against
the real provider: real Circle wallets, real Arc testnet transactions, not
a mock standing in for "trust me."

**Result:** A system where I can hand someone a transaction hash and say
"click that, it's real" — not "here's a screenshot." 113 tests covering
the actual threat model (rejected / unapproved / duplicate / tampered),
CI green, and a build log documenting every real bug found along the way
(an idempotency collision, a quota exhaustion, an architecture evaluation
that didn't pan out) instead of a sanitized "it just worked" story.

## Anticipated tough questions

**"Is this just a wrapper around an LLM calling an API?"**
No — the LLM's output is never trusted. It can propose; it cannot
authorize. The policy engine and execution path would behave identically
if the proposal came from a form instead of an agent. That separation is
the actual engineering content.

**"Real blockchain, or did you fake the settlement?"**
Real. `PAYMENT_PROVIDER=arc` calls Circle's developer-controlled wallets
API against Arc testnet — four transactions logged with hashes, checkable
on `testnet.arcscan.app` by anyone, including you, right now.

**"What would you do differently in production?"**
The in-memory repositories (documented explicitly as a hackathon-scale
choice) would become a real database behind the same interfaces — no
caller changes needed, since business logic already depends on interfaces,
not the in-memory implementation. Auth would move from a demo cookie to
real session management. And the Gemini model pinned mid-session as a
quota stop-gap would get an actual evaluated choice, not a same-day swap.

**"Did you build this entirely solo?"**
Yes, with an AI pair — and the build log documents every decision,
every bug, and every verification step in enough detail that another
engineer (or a fresh AI session) could pick it up cold. That log is itself
evidence of how you work, not just what you built.
