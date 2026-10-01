# Pitch notes

Reference doc, not a build phase — for conversations, the hackathon pitch,
and discovery calls. Two audiences, two different vocabularies:

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

### The honest line for judges

> "It executes real transfers on Arc testnet today — sub-second, provable,
> auditable. Taking it to real money needs bank/rail integration and real
> auth; that's the roadmap. We've validated demand with discovery calls and
> a waitlist, not just a synthetic demo."

Demo + validated demand + a clear path to production is a complete story —
nobody expects live payroll out of a hackathon build.
