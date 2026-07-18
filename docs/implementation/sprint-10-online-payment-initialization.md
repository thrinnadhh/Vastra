---
sprint: 10
ticket: S10-02
status: implemented
provider: cashfree
---

# S10-02 online checkout and payment initialization

`POST /v1/orders/online` prepares a customer-owned `PAYMENT_PENDING` order and a Cashfree payment attempt in one database transaction. Inventory is reserved for the payment window, but the order is not exposed to the merchant until a later verified payment event captures the payment.

The provider HTTP call occurs after the preparation transaction commits. The provider order identifier and idempotency key are deterministic, so a timeout or client retry reconciles the same Cashfree order rather than creating a second charge path. After Cashfree returns a payment session, `attach_customer_payment_session` validates the provider order, amount and currency before moving the payment attempt from `CREATED` to `PENDING`.

The client receives only the safe payment-session payload. It cannot supply an amount or mark a payment successful. `GET /v1/orders/:orderId/payments/latest` returns the latest attached session for a customer-owned order.
