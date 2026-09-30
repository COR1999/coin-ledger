# Policy & finance spec

## Limits

| | Owner | Accountant | Employee |
|---|---|---|---|
| Max single payment | €3,000 | €2,000 | €100 |
| Daily limit (own payments) | — | €5,000 | €300 |
| Suppliers | any | any | approved list only |
| Can edit policies | yes | no | no |
| Can approve others' requests | up to €3,000 | up to €2,000 | no |

## Business-wide rules

- **Business daily limit:** €10,000 across all roles.
- **Safe-to-spend:** reject if `amount > safe-to-spend`, where
  `safe-to-spend = balance − obligations due in next 30 days − €3,000 minimum reserve`
  (seed: €18,420 − €9,730 − €3,000 = **€5,690**).
- **Supplier monthly limits** (see `product.md`).
- **Confirmation threshold:** any payment above **€1,000** requires the executing person to explicitly confirm, including the owner.

All limits live in a policies object, owner-editable in the UI. Never hard-code rules in the AI prompt.

## Decision rules (in order)

1. Any business-wide rule broken → `rejected`.
2. Amount above owner's max single payment → `rejected`.
3. Employee paying a non-approved supplier → `rejected`.
4. Employee exceeding their **daily** limit → `rejected`.
5. Actor's **single-payment** limit exceeded but amount ≤ owner max → `needs_approval`; `requiredApproverRole` = lowest role whose single-payment limit covers the amount (accountant if ≤ €2,000, else owner).
6. Otherwise → `allowed`.
7. Approvers can only approve amounts within their own single-payment limit.
8. `requiresConfirmation = amount > €1,000`.

## Policy engine (`lib/policy/`)

Pure TypeScript: no React, Next.js, database or LLM dependencies. Deterministic. Fully tested. Clean enough to publish as a reusable package.

```ts
// Input
{
  proposedPayment: { supplierId: string; amount: string; currency: "EUR"; reason: string };
  actor: { id: string; role: "owner" | "accountant" | "employee" };
  businessState: { /* balance, obligations, today's payments by actor + business, supplier month-to-date spend */ };
  policies: { /* all limits above */ };
}

// Output
{
  decision: "allowed" | "needs_approval" | "rejected";
  requiredApproverRole?: "owner" | "accountant";
  requiresConfirmation: boolean;
  reasons: string[]; // human-readable, e.g. "Exceeds Liam's €100 single-payment limit"
}
```

## Finance engine (`lib/finance/`)

Deterministic functions: current balance, upcoming obligations, 30-day forecast, safe-to-spend, supplier month-to-date spend, projected balance after a proposed payment. Show the safe-to-spend formula in the UI.
