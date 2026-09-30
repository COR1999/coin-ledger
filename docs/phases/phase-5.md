# Phase 5 — First testnet transaction

**Read:** `docs/spec/payments.md`, Phase 4 answers in `BUILD_LOG.md`, and only the Arc docs needed.

1. One tiny, disposable transfer **outside the app flow** first. Verify: wallet, recipient, token, amount, gas, submission, confirmation, tx hash, explorer link.
2. Log it in `BUILD_LOG.md` → Testnet transactions.
3. Implement the real provider behind `PAYMENT_PROVIDER=arc`, following the confirmed architecture. Server-only, idempotent, typed errors.
4. Supplier-to-business refund script (testnet only).

Check definition of done. Then STOP.
