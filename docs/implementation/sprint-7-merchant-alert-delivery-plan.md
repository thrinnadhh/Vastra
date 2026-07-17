---
ticket: S7-01
sprint: 7
status: implemented
---

# Sprint 7 Merchant Alert Delivery Plan

## Goal

Deliver the frozen MVP merchant new-order alert reliably after the order transaction commits, without placing Firebase credentials in the merchant application or relying on unsupported call/alarm behaviour.

## Existing foundation reused

Sprint 6 already provides:

- `POST /v1/me/devices` for authenticated device and push-token registration.
- one durable `merchant_order_alerts` row per order entering `WAITING_FOR_MERCHANT`.
- one transactional `merchant.order.alert.created` outbox event.
- `POST /v1/merchant/order-alerts/{alertId}/acknowledge`.
- merchant order queue, detail, accept, reject, packing, and ready-for-pickup flows.

Sprint 7 extends those contracts instead of creating a second alert model.

## Ordered tickets

### S7-01 — Freeze delivery contracts

- Freeze this ticket map and the internal FCM payload contract.
- Keep push tokens and Firebase credentials backend-only.
- Define terminal stop rules and retry ownership.

### S7-02 — Select eligible merchant devices

- Reuse authenticated `user_devices` registration.
- Deliver only to active merchant Android devices registered with FCM.
- Exclude revoked devices, disabled notifications, disabled order sound, and empty tokens.

### S7-03 — Persist dispatch attempts and claim work safely

- Add append-only per-device delivery attempts.
- Claim outbox events with row locks and `SKIP LOCKED`.
- Make concurrent workers safe.
- Expose claim and completion RPCs only to the service role.

### S7-04 — Build and send the FCM HTTP v1 message

- Use a short-lived OAuth access token generated from backend-only Firebase service-account configuration.
- Send Android high-priority notification and data payloads.
- Use the dedicated `vastra_urgent_orders` channel, `vastra_new_order` sound, strong vibration, and a short TTL.
- Classify invalid-token, retryable, and permanent provider failures.

### S7-05 — Consume the alert outbox

- Drain claimed events from a lifecycle-managed backend worker.
- Record each device result transactionally.
- Publish the event after at least one successful send.
- Retry retryable failures with bounded exponential backoff.
- Stop without sending when the alert expired or the order left `WAITING_FOR_MERCHANT`.

### S7-06 — Expiry and reminder scheduler

- Expire unanswered alerts durably.
- Schedule repeated reminder outbox events.
- Stop reminders after acknowledgement, acceptance, rejection, cancellation, or expiry.

### S7-07 — Android urgent notification runtime

- Create the dedicated Android channel.
- Bundle the custom sound and vibration pattern.
- Handle background and killed-app messages without unsupported alarm/call shortcuts.

### S7-08 — Foreground urgent modal

- Show the urgent modal and response countdown.
- Loop in-app sound only while the alert remains active.
- Acknowledge explicitly and navigate to the authoritative order detail.

### S7-09 — Test Ringtone and diagnostics

- Add Test Ringtone.
- Diagnose permission, token, channel, sound, and battery/background restrictions.
- Provide recoverable setup guidance.

### S7-10 — Observability and physical-device acceptance

- Add admin-visible alert and delivery-attempt reads.
- Add delivery, retry, expiry, and failure metrics.
- Document and execute the physical Android test matrix.

## Internal push payload v1

Required data fields:

```text
schemaVersion=1
kind=MERCHANT_NEW_ORDER
alertId=<uuid>
orderId=<uuid>
orderNumber=<human-readable order number>
shopId=<uuid>
expiresAt=<UTC timestamp>
soundShouldPlay=true
```

Notification presentation:

```text
channelId=vastra_urgent_orders
sound=vastra_new_order
priority=high
visibility=private
```

The payload contains no customer phone number, address, push token, secret, or Firebase credential.

## Stop rules

A claimed alert is not sent when any condition is true:

- alert status is `ACKNOWLEDGED` or `EXPIRED`;
- order status is not `WAITING_FOR_MERCHANT`;
- `expires_at` is at or before the current database time;
- no eligible merchant FCM device remains.

Acknowledgement, merchant decision, cancellation, and expiry are authoritative database state. A delayed or duplicate outbox event must re-read that state before delivery.

## Retry rules

- Claims are transactional and safe across concurrent workers.
- Each provider attempt is append-only and tied to the outbox event, alert, and device.
- Retryable failures return the outbox event to `FAILED` with a future `available_at`.
- Invalid registration tokens revoke that exact device destination.
- Permanent failures dead-letter after the configured maximum attempts.
- A successful send publishes the outbox event even when another device failed; failed devices remain observable in attempt history.

## Parallel work boundaries

Safe independent streams:

1. SQL claim/completion contract and pgTAP coverage.
2. Pure FCM configuration, OAuth, payload, and response classification.
3. Dispatcher orchestration tests against ports.

Integration occurs only after the contracts above are frozen. Multiple agents must not independently edit the same migration, module wiring, or shared types.
