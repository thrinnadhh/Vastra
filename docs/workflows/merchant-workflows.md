---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# Merchant Workflows

## 1. Login and opening

```text
Login
→ Load approved shop
→ Check notification permission
→ Check order-alert channel
→ Test ringtone
→ Set Accept Online Orders = true
```

If notifications are disabled, show a blocking warning before going online.

## 2. Add product

```text
Open Products
→ Add product
→ Enter name, category, brand, description
→ Upload images
→ Add colour and size variants
→ Enter SKU, barcode, price, MRP
→ Add stock
→ Submit
→ Product becomes active or awaits moderation
```

## 3. Inventory adjustment

```text
Scan barcode or search manually
→ Select variant
→ Choose action
→ Enter quantity and reason
→ Backend locks inventory row
→ Validate result
→ Update balance
→ Create movement
→ Broadcast availability change
```

Actions:

- Add stock
- Offline sale
- Return to stock
- Mark damaged
- Stock correction
- Stock check

## 4. Offline sale

```text
Create offline sale
→ Scan/search items
→ Confirm variant and quantity
→ Select payment method
→ Submit with idempotency key
→ Backend validates stock
→ Create sale
→ Reduce stock
→ Create movements
→ Update customer availability
```

## 5. New order alert

```text
Backend creates order
→ Create merchant alert
→ Send high-priority push
→ Merchant device rings and vibrates
→ Foreground app opens urgent modal
→ Merchant acknowledges
→ Merchant reviews order
```

Sound stops when:

- Alert acknowledged
- Order accepted
- Order rejected
- Alert expires
- Admin cancels order

## 6. Accept order

```text
Review customer and item details
→ Physically verify every item
→ Accept
→ Choose preparation time
→ Backend validates order state
→ Status = MERCHANT_ACCEPTED
→ Start packing
```

## 7. Reject order

```text
Choose affected item
→ Choose issue reason
→ Add note/evidence when required
→ Submit rejection
→ Backend locks order
→ Record issue
→ Release reservation
→ Cancel order
→ Trigger refund when prepaid
→ Notify customer and admin
```

## 8. Packing

```text
Open packing list
→ Collect item
→ Verify barcode or manually confirm
→ Mark each item verified
→ Finish checklist
→ Mark Ready for Pickup
```

Ready for Pickup is disabled until required items are verified.

## 9. Damage during packing

```text
Open item
→ Report damaged
→ Add optional photo
→ Move quantity from sellable to damaged
→ Create issue
→ Cancel order in MVP
→ Notify customer/admin
```

## 10. Captain handover

```text
Captain assigned
→ Captain arrives
→ Merchant confirms captain identity
→ Verify pickup code
→ Hand over package
→ Captain confirms pickup
→ Merchant sees PICKED_UP
```

## 11. Returns

```text
Return arrives
→ Confirm receipt
→ Inspect item
→ Mark sellable, damaged, or disputed
→ Add evidence
→ Submit merchant decision
→ Admin/finance completes resolution
```

## 12. Merchant support

```text
Open Help
→ Choose order, inventory, payment, or account issue
→ Create ticket
→ Message support
→ Receive resolution
```
