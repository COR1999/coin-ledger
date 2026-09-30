# Product spec

## What it is

A **programmable financial operator for small businesses** (cafés, restaurants, retailers, agencies, trades, small service firms). Accounting software explains what happened; we answer **"What can I safely do with my money?"**

Flagship question: **"Can I pay ABC Coffee €2,400?"** The system understands it, reads the business state, checks policies, explains the result, determines who must approve, gets approval/confirmation, re-checks server-side, executes, tracks and updates the dashboard.

The UI should feel like a serious small-business finance product, **not** a crypto terminal. Show blockchain details only where useful (tx status, explorer link, demo-scale label).

## Users (role switcher, no real auth)

- Mario — Owner
- Aoife — Accountant
- Liam — Employee

## Mario's Coffee seed data

- Current balance: **€18,420**
- Obligations due in next 30 days: **€9,730** (rent, wages, utilities, insurance, software, supplier invoices, with realistic due dates)
- ~60 days of history: customer revenue, coffee and food suppliers, rent, wages, utilities, software, insurance, misc.

| Supplier | Employee-approved | Monthly limit | Spent this month |
|---|---|---|---|
| ABC Coffee (coffee beans) | yes | €8,000 | €4,600 |
| Local Veg Supplier (potatoes etc.) | yes | €1,500 | €300 |
| Unknown Vendor Ltd | **no** | — | €0 |

## Data architecture

In-memory seeded store behind repository interfaces (no Supabase unless needed):
`BusinessRepository`, `TransactionRepository`, `SupplierRepository`, `PaymentProposalRepository`, `PolicyRepository`.

## Agent (`lib/agent/`)

Anthropic API with tool calling.

- Read-only tools: `getBalance`, `getObligations`, `getForecast`, `getSupplier`, `checkPolicy`
- One mutation tool: `proposePayment`. It creates a **pending** proposal and never executes.
- Every tool argument validated with zod.
- Never invents numbers; explains decisions using the policy engine's `reasons`.

Proposal shape:

```ts
{ supplierId: "abc-coffee", amount: "2400.00", currency: "EUR", reason: "Supplier payment" }
```

Must handle: "How much cash do we have?", "What bills are coming up?", "How much can we safely spend?", "Why is our cash position lower?", "Can I pay ABC Coffee €2,400?", "What would happen if I paid €2,400?"

## Demo stories

1. **Liam:** "I need €30 of potatoes." → auto-approved → on-chain → tracked → dashboard updates.
2. **Liam:** "Pay ABC Coffee €2,400." → above his limit and above Aoife's approval limit → goes to **Mario** → Mario approves and confirms → server re-check → on-chain → tx hash shown → dashboard updates.
3. **Mario:** "Can I pay ABC Coffee €4,000?" → rejected → no transaction → agent explains the rule.
