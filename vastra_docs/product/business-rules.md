---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# Business Rules

## 1. Money and time

- Store money as integer paise.
- Never use floating-point arithmetic for money.
- Store timestamps in UTC using `timestamptz`.
- Convert time only at display boundaries.
- Order numbers are human-readable; UUIDs remain internal identifiers.

## 2. Cart

- One active cart per customer per shop.
- The MVP cart contains products from one shop only.
- Adding an item from another shop requires confirmation to clear the current cart.
- Prices are revalidated during checkout.
- Cart prices are not a payment guarantee.

## 3. Inventory

- Inventory exists at variant level.
- Available quantity is:

```text
stock_on_hand - reserved_quantity - damaged_quantity
```

- Inventory cannot become negative.
- Every inventory change creates an immutable inventory movement.
- Critical updates lock the inventory row.
- Offline sales reduce online stock immediately.
- Rejected or expired orders release reservations.
- Damaged products leave sellable stock.
- Mobile apps never directly update stock values.

## 4. Orders

- Every order belongs to one customer and one shop.
- Every order item stores a price and product snapshot.
- Every status change creates history.
- Invalid status transitions are rejected.
- Administrative overrides require a reason and audit record.
- Duplicate order requests use idempotency keys.

## 5. Merchant response

- New orders begin in `WAITING_FOR_MERCHANT`.
- The backend creates a merchant alert and sends high-priority push.
- Foreground merchant app plays a looping in-app sound.
- Reminder alerts continue until acknowledgement or expiry.
- Merchant may accept the full order or reject the full order in MVP.
- Partial fulfilment and substitution are excluded.

## 6. Order rejection reasons

Allowed reasons:

```text
OUT_OF_STOCK
SIZE_UNAVAILABLE
COLOUR_UNAVAILABLE
DAMAGED_ITEM
INVENTORY_MISMATCH
ITEM_NOT_FOUND
SHOP_BUSY
SHOP_CLOSING
OTHER
```

A rejected order:

1. Records the issue.
2. Releases reservations.
3. Cancels the order.
4. Starts refund when needed.
5. Notifies the customer.
6. Updates merchant quality metrics.

## 7. Packing

- Merchant verifies every item before Ready for Pickup.
- Verification methods: barcode or manual confirmation.
- Photo matching is post-MVP.
- Damaged-during-packing requires issue creation and stock correction.
- Handover requires correct pickup code.

## 8. Delivery assignment

- A delivery task can have only one accepted captain.
- Accepting an offer locks the task.
- Competing offers are cancelled.
- Admin can manually assign or reassign.
- Reassignment history is preserved.

## 9. Delivery completion

- Pickup requires pickup code.
- Delivery requires OTP unless an approved operations override is recorded.
- COD amount must match the expected amount.
- Completion creates captain earnings and merchant settlement eligibility.
- Captain cannot complete an unrelated task.

## 10. Payments

- Payment state comes from verified provider callbacks.
- Client confirmation alone is not authoritative.
- Webhook events are deduplicated using provider event ID.
- Payment verification uses raw request body and signature.
- Failed callbacks are retried safely.

## 11. Cancellations

- Customer may freely cancel before merchant acceptance.
- After merchant acceptance, cancellation requires policy evaluation or admin handling.
- Captain cancellation does not automatically cancel the order.
- Cancellation releases inventory when appropriate.

## 12. Returns

- Return eligibility uses category, product policy, order state, and return window.
- Customer chooses items and reasons.
- Evidence is private.
- Merchant may accept or dispute after receiving the item.
- Finance controls refund completion.
- Returned sellable stock is added only after inspection.

## 13. Favourite shops

- The Vastra QR is a general app download/open QR.
- It must not auto-favourite a shop.
- Customers voluntarily search and favourite.
- Merchants see aggregate follower metrics, not unnecessary customer identities.

## 14. Notifications

- Transactional notifications cannot be disabled when legally or operationally required.
- Marketing notifications respect preferences.
- Merchant order alerts use a separate urgent channel.
- Notification failure must be observable.
- Realtime is not a replacement for background push.

## 15. Privacy

- KYC, return evidence, and body-related files use private storage.
- Signed URLs expire.
- Service-role keys never appear in client apps.
- Sensitive fields are encrypted where appropriate.
- Access follows least privilege.

## 16. Audit

Audit these actions:

- Merchant and captain approval
- Account suspension
- Manual order override
- Refund initiation and approval
- Settlement adjustment
- Manual inventory correction
- Permission changes
- Admin login and high-risk access
