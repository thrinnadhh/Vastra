---
project: Vastra
version: 1.1
status: Frozen MVP
last_updated: 2026-07-11
---

# Customer Workflows

## 1. Registration and onboarding

```text
Open app
→ Enter mobile number
→ Receive OTP
→ Verify OTP
→ Create profile
→ Request location permission
→ Add address or use current location
→ Request notification permission
→ Open home
```

Failure states:

- Invalid OTP
- Expired OTP
- Too many attempts
- Network unavailable
- Unsupported service area
- Notification permission denied

## 2. Discovery

```text
Open home
→ Load serviceable location
→ Show banners, categories, nearby shops, favourites, and basic recommendations
→ Search or browse
→ Open shop
→ Open product
→ Select colour and size
→ Check variant availability
```

## 3. Favourite shop

```text
Open shop
→ Tap Favourite
→ Choose offer/new-arrival preferences
→ Save favourite
→ Show shop in Favourite Shops
```

Unfavourite must preserve historical orders.

## 4. Cart

```text
Select product variant
→ Add to cart
→ Validate one-shop rule
→ Update quantity
→ Recalculate subtotal
→ Continue to checkout
```

Errors:

- Variant inactive
- Insufficient stock
- Price changed
- Shop closed
- Cart contains another shop

## 5. Checkout

```text
Select address
→ Check serviceability
→ Request checkout quote
→ Review totals and ETA
→ Select COD or online payment
→ Place order with idempotency key
```

### COD

```text
Create order
→ Reserve inventory
→ Set WAITING_FOR_MERCHANT
→ Notify merchant
```

### Online payment

```text
Create pending order/payment
→ Open provider checkout
→ Provider confirms payment
→ Verified webhook captures payment
→ Reserve/confirm inventory
→ Set WAITING_FOR_MERCHANT
→ Notify merchant
```

The exact inventory-payment sequence must be chosen and documented per provider to avoid paid-but-unavailable orders.

## 6. Tracking

```text
Order placed
→ Merchant accepted
→ Packing
→ Ready for pickup
→ Captain assigned
→ Picked up
→ Out for delivery
→ Captain at customer
→ Delivered
→ Completed
```

Customer sees:

- Current status
- Timeline
- ETA
- Captain identity after assignment
- Contact controls
- Support control

## 7. Cancellation

### Before merchant acceptance

```text
Customer requests cancellation
→ Validate state
→ Cancel order
→ Release inventory
→ Start refund if prepaid
→ Notify merchant and customer
```

### After acceptance

```text
Customer requests cancellation
→ Show policy result
→ Submit support request when manual review is required
```

## 8. Return

```text
Open delivered order
→ Select eligible item
→ Select reason
→ Add note and evidence
→ Submit return
→ Admin reviews
→ Return pickup assigned
→ Item reaches merchant
→ Merchant inspects
→ Refund approved or dispute resolved
→ Refund completed
```

## 9. Support

```text
Choose order or account issue
→ View self-help
→ Create ticket
→ Send message/attachment
→ Receive admin response
→ Resolve
→ Close
```

## 10. Ratings

After completion:

- Rate product
- Rate shop
- Rate captain
- Optional text
- Moderation status applies

## 11. Wardrobe item

```text
Open Wardrobe
→ Request owner-scoped signed upload intent
→ Upload one supported photo to private storage
→ Submit manual category, colour, occasion, season, and optional notes
→ Backend verifies the uploaded object and creates the owned wardrobe item
→ View or edit the private item
```

Deletion:

```text
Choose owned item
→ Confirm delete
→ Backend marks item inaccessible and revokes new signed access transactionally
→ Active look references are removed or shown as unavailable
→ Private object is deleted; failed object deletion is retried without restoring access
```

Loading, empty wardrobe, upload progress, validation failure, expired upload URL,
and recoverable deletion states must be shown. No image recognition or AI step runs.

## 12. Saved look

```text
Create look and name it
→ Select owned wardrobe items and/or nearby-shop product variants
→ Save ordered composition
→ View current product price and availability
→ Rename, duplicate, or delete the owned look
```

From a look, the customer may add currently available product variants to the
customer's own cart. The backend revalidates source price, stock, and the one-shop
cart rule; wardrobe items never enter the commerce cart.

## 13. Group Style room

Owner flow:

```text
Create private room
→ Generate link or join code with UTC expiry
→ Invite participants
→ Share a Vastra product or a room-visible snapshot of an owned saved look
→ Vote, comment, and update shared shortlist
→ Remove a participant when necessary
→ Close room
```

Participant flow:

```text
Open invite link or enter join code
→ Authenticate
→ Backend validates open room, invite status, expiry, and usage
→ Join as active participant
→ Share products or owned looks
→ Cast or change one LOVE/MAYBE/SKIP vote per share
→ Comment, shortlist, or report abuse
→ Add an available product to the participant's own cart
```

An expired/revoked invite fails without revealing private room content. A removed
member immediately loses room and shared wardrobe-media access. Closing makes the
room read-only for retained members. Out-of-stock products remain visible with
refreshed source price/availability but cannot be added to cart. Every durable
action is committed before any optional realtime event is emitted.
