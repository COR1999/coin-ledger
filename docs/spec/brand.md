# Brand identity

## Direction: "Espresso & Ink"

Warm espresso ink on a cream page, a single copper accent, forest green kept
for "safe" — not neon, a real ledger green. Chosen over two alternatives
(a cool institutional "Ledger Slate" navy/blue, and a bold single-hue "Vault
Emerald") because it's the only one with a reason to exist for this specific
business: it ties the brand to the seed business — a coffee shop — instead of
reaching for generic fintech-blue, while the ink/cream/copper combination
still reads as considered and trustworthy, not "cute." Must still feel like a
serious small-business finance product (Mercury/Ramp/Stripe territory), never
a crypto terminal, per `product.md`.

Typography stays **Geist Sans / Geist Mono** app-wide (already wired, zero
extra font weight) — deliberately neutral so it works for any future client's
palette, not just a coffee shop. Only color is brand-specific.

## Per-company theming

The product is built to be sold to multiple small businesses, each of which
would want their own brand color — not Mario's Coffee's copper. Full
multi-tenancy (stored per client, switchable, admin-configurable) is **out of
scope** for this build (see root `CLAUDE.md`), so this stops short of that:

- `lib/branding/theme.ts` defines a `BrandTheme`: one shared typography/layout
  system, with **only color** swappable per business (`background`,
  `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `border`,
  `input`, `ring` — the same token set shadcn/ui already uses in
  `app/globals.css`).
- `getBrandTheme(businessId)` looks a theme up by business id, falling back to
  Mario's Coffee's own theme for any id it doesn't recognize — never
  unstyled.
- `app/layout.tsx` reads the current business, resolves its theme, and applies
  it as inline CSS custom properties on `<html>` — highest specificity,
  present from the first byte of server-rendered HTML, no flash of
  unstyled content.
- Adding a second client's brand later is one entry in
  `THEMES_BY_BUSINESS_ID`, not a rewrite.

**Semantic status colors (positive/caution/danger) are deliberately NOT part
of the theme** — they stay Tailwind's fixed emerald/amber/red across every
tenant. "Rejected" should always read as red and "executed" as green,
regardless of whose brand color is active; tying status to brand would make
the product harder to read, not easier.

## Voice & tone

Plain, direct, specific — states figures and reasons, never hedges.

- Empty chat state: *"Hi Mario, how can I help? Ask about cash position,
  upcoming bills, or request a payment."*
- Rejection: cites the actual rule and the actual numbers (e.g. "exceeds ABC
  Coffee's €8,000 monthly limit — €4,600 already spent this month"), never a
  bare "not allowed."
- Confirmation actions: plain verbs tied to the real action ("Confirm payment",
  "Send €2,400 to ABC Coffee") — never blockchain/crypto language
  ("Execute transaction", "Sign", "Broadcast") in user-facing copy, even
  though the payment really does settle on Arc.

## Process note

Explored as three full directions (palette, type, voice, applied to the real
dashboard/chat/approvals components) in a throwaway HTML handbook before any
production code changed, per the project's design-review process — nothing
was applied to the app until a direction was picked.

## 2026-10-03 revision: product renamed "Coin Ledger"; "Ledger" visual direction adopted

The original "Espresso & Ink" palette stays — this revision is shape and
type, not colour. Prompted by feedback that the UI, while on-brand, read as
"plain… doesn't have a memorable user experience." A second
handbook (three new directions — Ledger, Stamped Vault, Editorial Minimal —
same comparison method as above) was built; **Ledger** was adopted, with
Editorial Minimal's more generous spacing and softer depth borrowed in to
keep it from reading as severe.

**Supersedes the "Typography stays Geist Sans / Geist Mono app-wide" rule
above** — deliberately, not by oversight:

- **Headlines only** now use **Fraunces** (`--font-serif`), a serif display
  face — page H1s, the landing hero, the header's business-name lockup.
  Reason: a second typeface is the single highest-leverage way to give the
  product a voice distinct from generic blue-gradient fintech, without
  touching data legibility. Body copy and **all monetary/numeric values**
  stay Geist Sans / Geist Mono exactly as before — multi-tenant neutrality
  for data is preserved; only the brand voice layer changes.
- **Every number renders in Geist Mono** (`font-mono`), not just where it
  happened to apply before — stat card values, transaction amounts, tx
  hashes, proposal amounts, button labels. The product is a ledger; its
  numbers should read like one.
- **Tighter corner radius** (`--radius: 0.3rem`, was `0.625rem`) — cards
  read as considered ledger pages, not soft generic SaaS panels. One token
  change in `app/globals.css`, cascades everywhere via the existing
  `--radius-sm/md/lg/xl` derived tokens — no per-component radius edits
  needed.
- **Ledger-row dotted leaders** (`border-b border-dotted`) between a label
  and its amount, in the safe-to-spend formula breakdown and the mobile
  transaction cards — literally how a paper ledger lays out a line.
- **Status as outlined "seals," not filled pills** — a border in the
  status colour, transparent fill, uppercase mono label
  (`components/approvals/proposal-list.tsx`). Reads as stamped/attested
  rather than a generic badge, without the rotation/hard-shadow treatment
  of the rejected "Stamped Vault" direction (that one risked tipping into
  "cute," which this doc already warns against).
- **A copper top-rule** (`border-t-2 border-t-accent`) on cards carrying a
  headline number or a proposal — not applied to every card indiscriminately
  (settings forms, the waitlist form, chat bubbles stay plain) so the accent
  keeps meaning instead of becoming wallpaper.

Two directions were considered and not adopted: **Stamped Vault** (offset
hard-shadow cards, rotated rubber-stamp status) was the boldest and most
memorable in a quick scroll, but its stamp motif sits closest to the "cute"
line this doc warns against — parked, not deleted, in case a bolder push is
wanted later. **Editorial Minimal** (no typography change, softer shadows,
bigger radii) was the safest fallback; its spacing and depth were folded
into Ledger rather than used as the primary direction, since it alone didn't
address the original "not memorable" feedback.
