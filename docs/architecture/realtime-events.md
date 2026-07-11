---
project: Vastra
version: 1.1
status: Frozen MVP
last_updated: 2026-07-11
---

# Realtime Events

## 1. Delivery mechanisms

Use both:

- Supabase Realtime for foreground/live UI
- FCM/APNs for background and killed-app notifications

Realtime alone is insufficient for merchant ringing alerts.

## 2. Channel naming

```text
customer:{customerId}
order:{orderId}
shop:{shopId}
shop:{shopId}:orders
shop:{shopId}:inventory
captain:{captainId}
delivery:{deliveryTaskId}
operations:{cityId}
support:{ticketId}
group-room:{roomId}
```

## 3. Event envelope

```json
{
  "eventId": "uuid",
  "eventType": "order.status.changed",
  "version": 1,
  "occurredAt": "2026-07-11T10:20:00Z",
  "aggregateType": "ORDER",
  "aggregateId": "uuid",
  "data": {}
}
```

## 4. Customer events

- order.created
- order.status.changed
- order.merchant.accepted
- order.captain.assigned
- order.location.updated
- order.delivered
- return.status.changed
- refund.status.changed
- support.message.created
- wardrobe.look.share.updated
- group.room.activity.created

## 5. Merchant events

- merchant.order.new
- merchant.order.alert.reminder
- merchant.order.cancelled
- merchant.captain.assigned
- merchant.captain.arrived
- merchant.inventory.changed
- merchant.return.requested
- merchant.settlement.completed
- support.message.created

## 6. Captain events

- captain.delivery.offer
- captain.delivery.offer.cancelled
- captain.delivery.assigned
- captain.delivery.cancelled
- captain.merchant.ready
- captain.customer.address.updated
- captain.support.message

## 7. Admin events

- operations.order.delayed
- operations.order.unassigned
- operations.merchant.timeout
- operations.delivery.failed
- finance.refund.failed
- finance.payment.webhook.failed
- support.ticket.created

## 8. Merchant ringing flow

```text
Order committed
→ Outbox event merchant.order.new
→ Push worker sends FCM high-priority message
→ Merchant device notification channel plays custom sound
→ Foreground subscription opens urgent modal and loops sound
→ Merchant acknowledges
→ Backend marks alert acknowledged
→ Retries stop
```

## 9. Group Style events

- group.room.member.joined
- group.room.member.removed
- group.room.closed
- group.room.share.created
- group.room.vote.updated
- group.room.comment.created
- group.room.shortlist.updated

The backend persists and authorizes the durable action before publishing. Channel
authorization is re-evaluated on subscription and reconnect; removed members are
disconnected or denied immediately. Event payloads contain UUID references and
display-safe summaries, never wardrobe object keys, signed URLs, invite secrets, or
abuse-report details. Clients refetch product shares to obtain current integer-paise
price and availability.

## 10. Delivery guarantees

- Events are at-least-once.
- Consumers must be idempotent.
- Every event has unique eventId.
- Persist critical state before publishing.
- Use outbox processing retries.
- Dead-letter failed events after configured attempts.

## 11. Location updates

- High-frequency temporary location may use Realtime Broadcast.
- Persist durable snapshots every 15–30 seconds or at major events.
- Ignore stale timestamps.
- Reject impossible jumps when appropriate.
- Stop tracking after task completion.
