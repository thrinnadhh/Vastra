Implement captain delivery in focused tickets.

Scope:

- Captain online/offline
- Current location
- Delivery offers
- Exclusive acceptance
- Manual admin assignment fallback
- Pickup navigation data
- Pickup code verification
- Pickup confirmation
- Delivery tracking
- Customer arrival
- COD
- Delivery OTP
- Completion
- Failure reasons
- Earnings record

Acceptance:

- Two captains cannot accept one task.
- Wrong pickup code fails.
- Wrong delivery OTP fails.
- Captain sees only offered/assigned tasks.
- Completion is idempotent.
- COD amount is validated.
- Location tracking stops after completion.
- Order and delivery histories remain consistent.
- Tests include concurrency and authorization.

Return a ticket plan first. Execute one ticket at a time.
