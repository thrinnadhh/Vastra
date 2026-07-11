---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# API Error Codes

## Response format

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "The selected variant is unavailable.",
    "details": {},
    "retryable": false
  },
  "requestId": "uuid"
}
```

## Authentication and authorization

| Code | HTTP | Meaning |
|---|---:|---|
| AUTH_REQUIRED | 401 | No valid access token |
| AUTH_TOKEN_EXPIRED | 401 | Token expired |
| ACCOUNT_BLOCKED | 403 | Account blocked |
| ACCOUNT_PENDING | 403 | Account not yet approved |
| PERMISSION_DENIED | 403 | Missing permission |
| RESOURCE_NOT_OWNED | 403 | Resource belongs to another actor |

## Validation

| Code | HTTP | Meaning |
|---|---:|---|
| VALIDATION_ERROR | 400 | Request validation failed |
| INVALID_ENUM_VALUE | 400 | Unsupported value |
| INVALID_PHONE_NUMBER | 400 | Invalid phone format |
| INVALID_OTP | 400 | OTP incorrect |
| OTP_EXPIRED | 400 | OTP expired |
| RATE_LIMITED | 429 | Too many requests |

## Catalogue and inventory

| Code | HTTP | Meaning |
|---|---:|---|
| PRODUCT_NOT_FOUND | 404 | Product missing |
| VARIANT_NOT_FOUND | 404 | Variant missing |
| PRODUCT_INACTIVE | 409 | Product not orderable |
| VARIANT_INACTIVE | 409 | Variant not orderable |
| INSUFFICIENT_STOCK | 409 | Not enough stock |
| INVENTORY_CONFLICT | 409 | Concurrent update |
| BARCODE_NOT_FOUND | 404 | Unknown barcode |
| BARCODE_ALREADY_ASSIGNED | 409 | Duplicate barcode |
| NEGATIVE_INVENTORY_REJECTED | 409 | Adjustment would make invalid stock |

## Cart and checkout

| Code | HTTP | Meaning |
|---|---:|---|
| CART_NOT_FOUND | 404 | Cart missing |
| MULTI_SHOP_CART_NOT_ALLOWED | 409 | Different shop item |
| CART_PRICE_CHANGED | 409 | Price changed |
| CART_ITEM_UNAVAILABLE | 409 | Item unavailable |
| ADDRESS_NOT_SERVICEABLE | 409 | Address outside zone |
| CHECKOUT_QUOTE_EXPIRED | 409 | Quote expired |
| SHOP_NOT_ACCEPTING_ORDERS | 409 | Shop closed/paused |

## Orders

| Code | HTTP | Meaning |
|---|---:|---|
| ORDER_NOT_FOUND | 404 | Order missing |
| INVALID_ORDER_STATE | 409 | Command not allowed in current state |
| ORDER_ALREADY_EXISTS | 409 | Idempotent duplicate |
| ORDER_ALREADY_CANCELLED | 409 | Already cancelled |
| ORDER_CANCELLATION_NOT_ALLOWED | 409 | Policy disallows cancellation |
| MERCHANT_RESPONSE_EXPIRED | 409 | Merchant window expired |
| ORDER_ITEM_NOT_VERIFIED | 409 | Packing incomplete |

## Payments and refunds

| Code | HTTP | Meaning |
|---|---:|---|
| PAYMENT_NOT_FOUND | 404 | Payment missing |
| PAYMENT_FAILED | 402 | Provider payment failed |
| PAYMENT_SIGNATURE_INVALID | 400 | Invalid signature |
| PAYMENT_EVENT_DUPLICATE | 200 | Duplicate webhook accepted safely |
| REFUND_NOT_ALLOWED | 409 | Refund cannot be created |
| REFUND_ALREADY_EXISTS | 409 | Duplicate refund |
| REFUND_FAILED | 502 | Provider refund failed |

## Delivery

| Code | HTTP | Meaning |
|---|---:|---|
| DELIVERY_NOT_FOUND | 404 | Task missing |
| DELIVERY_ALREADY_ASSIGNED | 409 | Another captain accepted |
| CAPTAIN_NOT_AVAILABLE | 409 | Captain unavailable |
| PICKUP_CODE_INVALID | 400 | Wrong pickup code |
| DELIVERY_OTP_INVALID | 400 | Wrong delivery OTP |
| LOCATION_REQUIRED | 400 | Location missing |
| DELIVERY_COMPLETION_NOT_ALLOWED | 409 | State or actor invalid |

## Returns

| Code | HTTP | Meaning |
|---|---:|---|
| RETURN_NOT_ELIGIBLE | 409 | Policy does not allow return |
| RETURN_WINDOW_EXPIRED | 409 | Window expired |
| RETURN_ALREADY_REQUESTED | 409 | Duplicate request |
| RETURN_EVIDENCE_REQUIRED | 400 | Evidence missing |

## Support and admin

| Code | HTTP | Meaning |
|---|---:|---|
| TICKET_NOT_FOUND | 404 | Ticket missing |
| ADMIN_REASON_REQUIRED | 400 | Override reason missing |
| APPROVAL_REQUIRED | 409 | Second approval required |
| AUDIT_WRITE_FAILED | 500 | Sensitive action not completed |

## System

| Code | HTTP | Meaning |
|---|---:|---|
| IDEMPOTENCY_KEY_REQUIRED | 400 | Missing key |
| IDEMPOTENCY_CONFLICT | 409 | Same key, different request |
| EXTERNAL_SERVICE_UNAVAILABLE | 503 | Provider unavailable |
| INTERNAL_ERROR | 500 | Unexpected error |
| MAINTENANCE_MODE | 503 | Temporarily unavailable |

## Client handling rule

- `retryable: true`: retry with exponential backoff.
- `409`: refresh state before retrying.
- `401`: refresh session once, then require login.
- `403`: do not retry automatically.
- `429`: wait for server-provided delay.
- `5xx`: show recoverable error and preserve user input.
