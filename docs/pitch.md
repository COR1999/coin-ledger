# Pitch notes

Reference doc, not a build phase — for conversations, the hackathon pitch,
and discovery calls. Two audiences, two different vocabularies:

## The actual rubric (Tameion, received 2026-10-03 — see BUILD_LOG.md)

30% agentic sophistication · 30% traction · 20% Circle tool usage · 20%
innovation. Everything below should be read against those four, not
generic "hackathon pitch" instinct:

- **Traction (30%)** = this doc's own section below, plus the waitlist/
  onboarding work (Phases 8–9) — real signups and real discovery-call
  conversations, not vague interest.
- **Circle tool usage (20%)** = currently Circle developer-controlled
  wallets for execution. x402 would be a second, genuinely Circle-native
  angle, but it's parked at the Aomi/Canteen/Tameion integration boundary
  (BUILD_LOG Integration Q&A #10) until confirmed — not guessed into
  half-working code for the sake of a score.
- **Agentic sophistication (30%)** = the propose → policy-decide →
  human-approve → re-verify-and-execute chain itself, and that the agent
  has no path around any step of it.
- **Innovation (20%)** = the human-in-the-loop policy gate is genuinely
  different from what else exists in the ecosystem — see
  `packages/agent-policy-gate/README.md` for the direct comparison against
  `dolepee/arc-mirror-kit`, the closest prior art found.

- **In-app UI** stays plain-English, never blockchain language — see
  `docs/spec/brand.md`'s voice & tone rules ("Confirm payment", never
  "Execute transaction" or "Sign"). That rule stands; it doesn't change here.
- **This doc** is where *you* talk about Arc/on-chain explicitly, to judges,
  investors, or a small-business owner deciding whether to trust it.

## The on-chain value prop for SMBs

The gap this fills right now: nothing in the product currently explains
*why* settling on Arc beats a normal bank transfer. Here's the actual case,
in order of what a small-business owner cares about:

1. **Speed.** Arc has deterministic finality in under a second (verified
   live, see `BUILD_LOG.md`). A SEPA/ACH transfer takes 1–3 business days and
   doesn't move at all on weekends or bank holidays. A supplier waiting on
   payment is waiting on a bank's clock, not yours.
2. **Always-on.** No cutoff times, no "payment will process next business
   day." The agent proposes, a human approves, it settles — any hour, any
   day.
3. **Transparent, stable fees.** Gas is paid in USDC with EWMA-smoothed base
   fees — predictable. Compare to wire fees, card interchange, or FX spread
   on an international transfer, all of which are opaque until after the
   fact.
4. **An audit trail nobody can quietly edit.** Every executed payment carries
   a real transaction hash and an explorer link (`testnet.arcscan.app`).
   An accountant — or an owner who doesn't trust their bookkeeper's AI yet —
   can independently verify every payment happened, for the exact amount,
   with nothing to take on faith. This is the single strongest answer to "why
   would I let an AI touch my money" — because it isn't being asked to.
5. **Cross-border without FX pain.** EURC/USDC settlement sidesteps the FX
   spread a small business eats every time it pays an overseas supplier
   through a traditional bank. Relevant the moment a business has even one
   non-domestic supplier.
6. **A foundation, not a dead end.** Today it's one business paying its own
   suppliers. The same rails (policy-gated proposals, on-chain settlement)
   are what agent-to-agent payments and x402-style automated invoicing need
   later — this isn't a one-off integration, it's infrastructure the product
   can grow into.

**The real sell isn't "it's blockchain."** It's: *your AI bookkeeper can
safely be trusted with proposing payments, because a policy engine and a
human gate every one of them, and the result is independently provable
afterward — not just logged in a database you're asking them to trust.*
On-chain settlement is what makes "provable afterward" true without asking
for their faith.

## Traction tactics

Adapted from Tameion's general guidance — one tactic from it doesn't fit
(mining forks/issues on an upstream OSS project: this is a greenfield app,
not a fork) and is dropped rather than forced.

1. **Your own network first.** Anyone running a small business or
   freelancing counts — you're closer to a real first user than it feels.
2. **Communities where the pain already shows up**: r/smallbusiness,
   r/FireflyIII, bookkeeping/accounting subreddits, local small-business
   Slack/Discord groups. Approach as *"I built a tool for this, could I get
   15 minutes of your time?"* — concise, respectful, not a pitch in the DM.
3. **The waitlist (Phase 9)** turns "people were interested" into a number
   you can actually cite.
4. **LinkedIn**, searching for small-business owners/freelancers posting
   about invoicing or bookkeeping pain — the same discovery-call approach.

### Discovery call script (15 min)

1. Show the demo live — their reaction to the agent proposing a payment and
   a human approving it is the signal, not a slide.
2. Ask directly: *"Would you trust this to propose payments for your real
   suppliers? What would have to be true first?"*
3. Ask: *"Do you pay any suppliers overseas, or ever hit a bank's weekend/
   cutoff-time delay?"* — surfaces whether the on-chain speed/FX case lands
   for them specifically.
4. Log the call in `BUILD_LOG.md`; if they want in, point them at the
   waitlist or — once Phase 8 ships — let them try it with their own
   business live on the call.

## Real bank/money hookup — the production path

The question a real owner asks right after "I like this": *"How does it
actually touch my bank?"* Two genuinely separate problems — don't conflate
them in the pitch, they have different partners and different difficulty:

1. **Seeing their real money (read-only).** The agent needs real balance and
   transaction data instead of seed data. This is Open Banking: Plaid (US,
   OAuth-style bank login, never their password) or TrueLayer/Tink/Yapily
   (EU/UK PSD2 equivalent) — a business connects their real account once,
   you get read access to balance + transactions. Well-trodden; Mercury,
   Ramp and every modern SMB fintech does exactly this. Not built here.
2. **Actually paying a supplier (write, real money moving).** This is the
   hard part, and has two real paths, not one:
   - **Become a payment-initiation party yourself** — the same Open
     Banking providers' "Payment Initiation" APIs, or a BaaS partner
     (Modern Treasury, Unit, Column, or a sponsor bank's own API) to fire
     a real ACH/SEPA transfer. Means KYB, compliance overhead, and often a
     sponsor-bank relationship — a real licensing/partnership lift, not a
     weekend's integration.
   - **Keep the stablecoin bridge we already have.** The business funds a
     Circle-managed wallet from their real bank (an on-ramp — ACH/wire,
     Circle already supports this for real USDC, not just testnet), the
     agent's policy-gated spending power lives against *that* wallet, and
     the supplier either holds the stablecoin or off-ramps it to their own
     bank. This is the realistic near-term path: it reuses the rails
     already built instead of requiring us to become a payment-initiation
     licensee.

**The sellable mental model**: *"You're not handing an AI your bank
credentials or wire-transfer authority. You top up a wallet, like loading a
corporate card — the agent can only spend what's in it, only within the
policy limits you set, and every payment is independently provable
afterward."* That reframes "AI touching my money" from a leap of faith into
something closer to a corporate card with a hard, auditable limit — the
objection most owners will actually raise first.

### The honest line for judges

> "It executes real transfers on Arc testnet today — sub-second, provable,
> auditable. Taking it to real money needs bank/rail integration and real
> auth; that's the roadmap. We've validated demand with discovery calls and
> a waitlist, not just a synthetic demo."

Demo + validated demand + a clear path to production is a complete story —
nobody expects live payroll out of a hackathon build.
