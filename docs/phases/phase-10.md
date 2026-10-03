# Phase 10 — Reusable primitive + Tameion submission prep

**Read:** `docs/pitch.md` (on-chain value prop), `BUILD_LOG.md`'s Tameion rubric section (received 2026-10-03) and Integration Q&A #10.

Two threads, prompted by research into what actually makes a submission stand out, then reprioritized once the real Tameion rubric arrived mid-phase.

## 1. Extract the policy engine as a standalone primitive

Arc OSS's own stated criteria reward "reusable building blocks... a separate repository that's easy to fork," not a standalone app. `lib/policy/engine.ts` was already pure — genuinely extracted (not copied) to `packages/agent-policy-gate/`, with the host app now a thin adapter calling the real package. Currency-agnostic (`formatAmount` injected, no hardcoded EUR), app-agnostic (`Supplier` → `Payee`, zero imports from the host app).

- `packages/agent-policy-gate/src/{types,engine,index}.ts` + its own `README.md` (the standalone pitch) + `package.json`
- `lib/policy/engine.ts` rewritten as an adapter — zero call-site changes anywhere else in the app
- Checked for prior art first: `dolepee/arc-mirror-kit` sounded closest but is a different model entirely (on-chain Solidity, automatic per-follower execution, no human approval step) — genuinely complementary, not duplicative

## 2. x402 — stopped at the integration boundary

`CLAUDE.md` names x402 explicitly as an Aomi/Canteen/Tameion topic. Researched it anyway to know what question to ask (worth 20% of score as "Circle tool usage"), found two sources disagreeing on header names and no explicit Arc listing in supported networks — logged as Integration Q&A #10, not built.

## 3. Tameion rubric received — changes priority

30% agentic sophistication · 30% traction · 20% Circle tool usage · 20% innovation. Deadline 2026-10-10, 11:59 PM ET. Public repo + <3min demo video + MIT license preferred, required for submission.

- Added root `LICENSE` (MIT) — safe to do now; the repo is still private, so this has no external effect until the separate decision to make it public.
- Still open, needs Philip's decision (see BUILD_LOG Status): make the repo public, record the demo video, deploy somewhere with a live link.

## Report

```text
Package extracted, app dogfoods it   ✓/✗
Package has its own tests + README   ✓/✗
x402 boundary documented, not guessed ✓/✗
LICENSE added                         ✓/✗
Tameion rubric logged in BUILD_LOG    ✓/✗
```

Then STOP — the three submission blockers (public repo, video, deployment) are Philip's calls, not mine.
