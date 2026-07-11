Implement the first complete COD order vertical slice.

Flow:

```text
Customer places COD order
→ backend validates quote
→ inventory row is locked
→ inventory is reserved
→ order and item snapshots are created
→ status history and outbox event are created
→ merchant receives order in app
→ merchant accepts
→ merchant packs and marks ready
→ admin can see the order
```

Acceptance:

- Idempotency-Key required.
- Duplicate request creates one order.
- Last unit cannot be sold twice.
- Invalid state transitions fail.
- Customer sees only own order.
- Merchant sees only own shop order.
- Every state change has history.
- Outbox event is written transactionally.
- Integration and concurrency tests pass.

Do not implement online payment in this slice.

Return a ticket plan first. Execute one ticket at a time.
