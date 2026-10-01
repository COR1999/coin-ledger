# Phase 9 — Landing page + waitlist

**Read:** `docs/spec/brand.md` (voice & tone — landing copy follows the same
plain, specific, never-hedging rules as the rest of the app).

**Goal:** a cold visitor arriving at the root domain understands the product
in one screen, can try it immediately (canned demo or their own business via
Phase 8's onboarding), and can leave an email if they're not ready to try it.

## Decision made before building (confirmed with Philip)

- **Routing:** the landing page takes over `/`. The existing dashboard moves
  to `/app`. Every internal link/redirect that currently points at `/`
  (role switcher, nav, post-login redirects) needs updating to `/app`.

## Tasks

1. Move the dashboard: `app/page.tsx` → `app/app/page.tsx` (and sibling
   layout/data-loading if any lives alongside it). Update every internal
   `href`/`redirect` that assumed the dashboard was at `/`.
2. New `app/page.tsx` (marketing landing): the pitch (one line — see
   `docs/pitch.md`), three CTAs:
   - **Try the demo** → sets `workspaceId=demo`, goes to `/app`.
   - **Try with your business** → `/onboarding` (Phase 8).
   - **Join the waitlist** → inline form, see below.
3. Waitlist domain type + storage, matching the existing repository pattern:
   - `lib/domain/types.ts`: `WaitlistSignup { id, name, email, businessType,
     note?, createdAt }`.
   - Repository method on the same interface shape as suppliers/transactions
     (`lib/repositories/types.ts` + `in-memory.ts`).
   - Server action, zod-validated (name, email format, businessType), with
     loading/success/error states on the form per the engineering standards
     (no silent failures).
4. No email sending in scope — signups are persisted and visible to you only
   (a simple authenticated list is enough; full admin UI is out of scope).
   Note in `BUILD_LOG.md`: once there are real signups, log them with
   `arc-canteen update-traction` (never run without confirmation).

## Report

```text
Landing page at /         ✓/✗
Dashboard moved to /app    ✓/✗
Demo CTA                   ✓/✗
Onboarding CTA              ✓/✗
Waitlist form + storage     ✓/✗
Tests                       ✓/✗
```

Check definition of done. Then STOP.
