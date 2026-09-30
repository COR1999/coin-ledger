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
