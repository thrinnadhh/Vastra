---
sprint: 10
ticket: S10-04
status: implemented
---

# S10-04 payment event processing and recovery

Verified `RECEIVED` events are processed under the frozen order → payment → event lock order. A successful payment captures the payment, synchronizes the order, and moves a `PAYMENT_PENDING` order to `WAITING_FOR_MERCHANT`, reusing the existing durable merchant-alert trigger. Verified failure or user-drop events cancel only unpaid pending orders and release only their active order-owned inventory reservations.

Captured/refunded payments never regress. Identity or amount mismatches are retained as failed events for investigation. A background worker drains bounded batches, while an AAL2 finance manager can idempotently requeue a failed event through `POST /v1/admin/payments/events/:eventId/retry` with immutable audit history.
