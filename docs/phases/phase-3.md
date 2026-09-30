# Phase 3 — Agent + approval flow (mock)

**Read:** `docs/spec/product.md` (Agent section), `docs/spec/payments.md` (Provider interface only).

Build: chat interface, Anthropic tool calling, read-only tools + `proposePayment`, zod validation on every tool argument, approval queue (shows who can approve what), confirmation step for payments above €1,000, role-aware approval, the single server-side execution path, `MockPaymentProvider`.

```text
User → Agent → Proposal → Policy Engine → Approval/Confirmation
→ Server-side re-check → Mock Payment → Confirmation → Dashboard update
```

Tests for the execution path: rejected proposal, missing approval, missing confirmation, wrong approver role, duplicate execution, tampered client request must all fail safely. Test pending, confirmed and failed provider states.

Run the three demo stories from `product.md` end-to-end on the mock. Check definition of done. Then STOP.
