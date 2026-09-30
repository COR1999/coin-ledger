# Phase 1 — Finance + policy engine

**Read:** `docs/spec/policy.md`, `docs/spec/product.md` (seed data + repositories only).
**Recommended model:** strongest available. This is the core logic.

Build repository interfaces, seed data, `lib/finance/`, `lib/policy/`, and Vitest tests. Write tests first where practical.

**Each test sets up its own state fixture.** Each states actor, role, supplier, amount, relevant state, expected decision, approver, confirmation flag and reasons.

| # | Scenario | Expected |
|---|---|---|
| 1 | Mario pays ABC Coffee €500 | allowed, no confirmation |
| 2 | Mario pays ABC Coffee €2,400 | allowed, `requiresConfirmation: true` |
| 3 | Liam pays ABC Coffee €2,400 | needs_approval, approver **owner** |
| 4 | Mario pays ABC Coffee €4,000 | rejected (over owner max) |
| 5 | Mario pays €2,500 when safe-to-spend is €2,000 (fixture) | rejected (breaches reserve) |
| 6 | Liam pays Local Veg €30 | allowed, no confirmation |
| 7 | Liam pays Unknown Vendor Ltd €50 | rejected (not approved supplier) |
| 8 | Liam pays Local Veg €150 | needs_approval, approver **accountant** |
| 9 | Liam has paid €280 today, pays Local Veg €30 | rejected (employee daily limit) |
| 10 | ABC Coffee at €6,000 this month (fixture), Mario pays €2,400 | rejected (supplier monthly limit) |
| 11 | Aoife pays ABC Coffee €2,400 | needs_approval, approver **owner** |
| 12 | Business has paid €9,000 today (fixture), Mario pays €1,500 | rejected (business daily limit) |
| 13 | Aoife tries to approve Liam's €2,400 request | not permitted (above her approval limit) |

Also test finance functions: safe-to-spend from seed = €5,690; projected balance after payment; 30-day forecast.

Run all tests, show results, check definition of done. Then STOP.
