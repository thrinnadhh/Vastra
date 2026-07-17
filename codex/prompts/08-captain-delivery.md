Implement Sprint 8 captain delivery one frozen ticket at a time.

Canonical contract:

- `docs/implementation/sprint-8-captain-delivery-contracts.md`

Scope:

- Captain availability and current location
- Forward-delivery task creation and search
- Nearby expiring delivery offers
- Exclusive captain acceptance
- Manual admin assignment fallback
- Captain active-delivery and pickup journey
- Pickup-code verification
- Customer delivery tracking
- Customer arrival
- Exact COD collection using `orders.total_paise`
- Delivery-OTP verification
- Idempotent delivery completion
- Failure reporting
- Per-task captain earnings

Explicitly deferred:

- Product pricing, commission, margin, and discount strategy
- Online payments
- Merchant settlement transfers
- Captain payout transfers
- Returns, exchanges, and reverse logistics
- Batched or multi-order routes
- Customer pickup

Frozen successful state path:

```text
READY_FOR_PICKUP
  -> CAPTAIN_SEARCHING
  -> CAPTAIN_ASSIGNED
  -> CAPTAIN_AT_STORE
  -> PICKED_UP
  -> OUT_FOR_DELIVERY
  -> CAPTAIN_AT_CUSTOMER
  -> DELIVERED
```

`DELIVERED` is the successful terminal order state for Sprint 8. Sprint 8 does not
move an order to `COMPLETED`.

Ordered tickets:

1. S8-01 — Contract and lifecycle freeze
2. S8-02 — Captain availability and current location
3. S8-03 — Forward-delivery task and verification-secret hardening
4. S8-04 — Nearby captain offers, expiry, and search expansion
5. S8-05 — Exclusive acceptance and manual assignment fallback
6. S8-06 — Captain active-delivery and pickup journey
7. S8-07 — Pickup-code verification and package handover
8. S8-08 — Customer tracking and location privacy
9. S8-09 — Customer arrival, exact COD, and delivery OTP
10. S8-10 — Idempotent completion, problems, earnings, and end-to-end hardening

Mandatory invariants:

- Two captains cannot accept one task.
- One captain cannot own two active forward-delivery tasks.
- Captain clients see only their own offers and assigned tasks.
- Customers see tracking only for their own active order.
- Merchants see delivery status only for orders belonging to their shops.
- Raw pickup codes and delivery OTPs are never returned to captains, logged, or emitted.
- Wrong pickup codes and delivery OTPs fail without advancing state.
- Verification attempt limits are durable.
- COD amount must equal the authoritative `orders.total_paise` value.
- Captain earnings are separate from collected COD cash.
- Completion is atomic and idempotent.
- Order, task, assignment, COD, earnings, and history cannot diverge.
- Location tracking ends after terminal resolution.
- Post-pickup package custody is never silently reassigned.
- Lifecycle writes follow the frozen database lock order.
- Durable state is committed before push, realtime, or outbox consumption.
- Tests include authorization, replay, concurrency, invalid transitions, and rollback.

Execution rules:

- Read the canonical contract before every ticket.
- Reuse the existing delivery tables, dispatch-start function, append-only histories,
  and service-role write pattern.
- Do not introduce a second delivery state machine.
- Do not pull later-ticket runtime work into an earlier ticket.
- Add or update OpenAPI contracts with the ticket that implements the endpoint.
- Run formatting, lint, typecheck, relevant unit/integration tests, Supabase tests,
  OpenAPI validation, and build before completing each ticket.
- Commit each ticket separately with its ticket ID.
- Stop after the requested ticket and report validation honestly.
