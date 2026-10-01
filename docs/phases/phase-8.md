# Phase 8 — Bring-your-own workspace (onboarding)

**Read:** `docs/spec/product.md` (seed data shape), `lib/domain/types.ts`,
`lib/repositories/types.ts`.

**Goal:** a real visitor can try the app with *their own* business — not just
Mario's Coffee — without touching the canned demo or another visitor's data.

## Decisions made before building (confirmed with Philip)

- **Isolation model:** one in-memory workspace per visitor, not one shared
  mutable business. A `workspaceId` cookie (same pattern as `actorId` in
  `lib/session.ts`) selects it; default `"demo"` is today's untouched Mario's
  Coffee seed.
- **Payment safety:** any non-`"demo"` workspace is forced onto
  `PaymentProvider = mock`, regardless of the server's `PAYMENT_PROVIDER` env.
  No visitor should need a real Circle wallet provisioned just to try the app.
- **Theming:** no new work needed — `getBrandTheme(businessId)` (see
  `docs/spec/brand.md`) already falls back to Mario's Coffee's theme for any
  unrecognized business id.

## Tasks

1. `lib/repositories/singleton.ts`: replace the single global instance with a
   `Map<workspaceId, Repositories>`, lazily creating a fresh in-memory
   workspace on first access. Same `Repositories` interface everywhere else —
   no caller changes beyond threading the workspace id through.
2. `lib/session.ts` (or a sibling `lib/workspace.ts`): add a `workspaceId`
   cookie, `getCurrentWorkspaceId()` / `setCurrentWorkspaceId()`, default
   `"demo"`.
3. Onboarding wizard at `/onboarding`: business name, 2–3 suppliers (name,
   category, employee-approved, monthly limit), role limits pre-filled from
   `seedPolicies` as sensible defaults and editable. Keep the same 3 roles
   (owner/accountant/employee) — only the names and limits are the visitor's.
4. Server action `createWorkspace` (zod-validated input): builds a `Business`
   + 3 `Actor`s + `Supplier[]` + `Policies`, generates a new workspace id,
   stores it via the repositories map, sets the cookie, redirects into the
   dashboard.
5. Force mock provider: wherever `PAYMENT_PROVIDER` is read for execution
   (`lib/payments/provider.ts`), override to `mock` whenever
   `workspaceId !== "demo"`. Document this override inline.
6. Header (`components/app/app-header.tsx`): show which business/workspace is
   active; a link back to the canned demo (`workspaceId=demo`).
7. Tests: workspace creation produces isolated, independent state; two
   workspaces never see each other's data; the mock-provider override holds
   even when `PAYMENT_PROVIDER=arc` in env.

## Report

```text
Workspace isolation     ✓/✗
Onboarding wizard        ✓/✗
Mock-provider override   ✓/✗
Header indicator         ✓/✗
Tests                    ✓/✗
```

Check definition of done. Then STOP.
