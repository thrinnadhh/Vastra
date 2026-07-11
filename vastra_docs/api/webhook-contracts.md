---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# Webhook Contracts

## 1. General requirements

Every webhook handler must:

1. Read raw body.
2. Verify provider signature.
3. Extract provider event ID.
4. Insert event with unique constraint.
5. Return success for already processed duplicate.
6. Perform state changes idempotently.
7. Record processing result.
8. Queue expensive work.
9. Return a fast 2xx response.

## 2. Payment webhook

Endpoint:

```http
POST /v1/webhooks/payments/{provider}
```

Required stored fields:

- provider
- provider_event_id
- event_type
- raw payload
- signature verification result
- received_at
- processed_at
- processing status
- error message

Supported normalized events:

```text
payment.created
payment.authorized
payment.captured
payment.failed
refund.created
refund.processed
refund.failed
```

Normalized internal payload:

```json
{
  "eventId": "provider-event-id",
  "eventType": "payment.captured",
  "provider": "cashfree",
  "occurredAt": "2026-07-11T10:20:00Z",
  "data": {
    "providerOrderId": "string",
    "providerPaymentId": "string",
    "amountPaise": 245000,
    "currency": "INR",
    "status": "CAPTURED"
  }
}
```

## 3. Payment processing rules

### Captured

- Find internal payment by provider order ID.
- Validate amount and currency.
- If already captured, return success.
- Mark payment captured.
- Advance order only when legal.
- Create status history and outbox event.

### Failed

- Mark payment failed when transition is legal.
- Release inventory reservation if applicable.
- Cancel pending order if policy requires.
- Notify customer.

### Refund processed

- Mark refund completed.
- Update order/return financial status.
- Notify customer.
- Record audit event where required.

## 4. SMS webhook

Optional endpoint:

```http
POST /v1/webhooks/sms/{provider}
```

Normalized events:

- message.delivered
- message.failed
- otp.delivered
- otp.failed

Never accept OTP verification from a delivery-status webhook.

## 5. Storage/media processing webhook

Endpoint:

```http
POST /v1/webhooks/media/processing
```

Use for future image processing.

Required:

- signed provider callback
- job ID
- file path
- status
- output metadata
- error details

## 6. AI webhook placeholders

Post-MVP:

```http
POST /v1/webhooks/ai/body-scan
POST /v1/webhooks/ai/virtual-tryon
```

Both must:

- Verify signature
- Check job ownership
- Avoid exposing raw images publicly
- Store model version
- Store quality score
- Schedule raw-image deletion
- Be idempotent

## 7. Retry policy

- Provider retries may arrive out of order.
- Process based on valid state transitions, not arrival assumptions.
- Internal retry uses exponential backoff.
- Dead-letter after maximum attempts.
- Alert operations for payment/refund dead letters.
