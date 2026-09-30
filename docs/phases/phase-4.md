# Phase 4 — Integration architecture

**Do not start automatically. Implement nothing in this phase.**

These questions were sent to Aomi/Canteen/Tameion in advance. Check `BUILD_LOG.md` → *Integration questions & answers* first.

1. Is Arc testnet still the right network for this hackathon now that mainnet is live?
2. What wallet architecture should a small-business app use: raw key wallet, Circle developer-controlled wallets, or an Aomi agent wallet?
3. Should the on-chain executor be an Aomi agent? If so, how does it receive an already-authorized payment request from our server?
4. What should sign transactions, and where should keys live?
5. Confirm EURC as the settlement token and its testnet contract.
6. How is gas handled (USDC balance required, or a paymaster)?
7. Recommended way to monitor transaction status?
8. Are transactions sent through our `arc-canteen rpc-url` automatically tracked for our project?
9. Recommended use of `update-product`, `update-traction` and `submit-showcase`?

For any unanswered question, give me the exact wording to send. Once answered: record them in `BUILD_LOG.md`, summarize the resulting architecture, and explain any differences from our current design (see `docs/spec/payments.md`). Then STOP.
