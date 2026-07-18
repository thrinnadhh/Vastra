---
sprint: 10
ticket: S10-03
status: implemented
provider: cashfree
webhook_version: 2025-01-01
---

# S10-03 signed webhook ingestion

`POST /v1/webhooks/payments/cashfree` is public only at the HTTP-authentication layer. It accepts an event only after HMAC-SHA256 verification using `x-webhook-timestamp`, the exact unmodified raw body and `PAYMENT_SECRET_KEY`. The required webhook version is `2025-01-01`, and its `x-idempotency-key` is the durable provider event identity.

Verified payment success, failed and user-dropped events are inserted into `payment_events` with processing status `RECEIVED`. Duplicate delivery of the same payload returns the existing receipt. Reuse of the same event identity with different data is rejected.

This ticket intentionally does not update `payments` or `orders`. S10-04 owns authoritative event processing, stale-transition handling, payment recovery and merchant notification.
