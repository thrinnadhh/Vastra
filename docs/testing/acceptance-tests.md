---
project: Vastra
version: 1.1
status: Frozen MVP
last_updated: 2026-07-11
---

# Acceptance Tests

## Customer

### AC-C01 Registration

Given a new phone number  
When the user verifies a valid OTP  
Then a customer profile is created and the user reaches onboarding.

### AC-C02 Nearby shops

Given a serviceable location  
When the customer opens Home  
Then approved, open, nearby shops are returned in distance order.

### AC-C03 One-shop cart

Given a cart containing Shop A  
When the customer adds an item from Shop B  
Then the app asks to clear the current cart and does not silently mix shops.

### AC-C04 Last unit

Given one available unit  
When two customers place an order concurrently  
Then only one order reserves the unit and the other receives `INSUFFICIENT_STOCK`.

### AC-C05 Order

Given a valid cart and address  
When the customer places a COD order with an idempotency key  
Then one order is created, inventory is reserved, and merchant alert is created.

### AC-C06 Duplicate order request

Given a successful order request  
When the exact request is repeated with the same idempotency key  
Then no duplicate order is created.

### AC-C07 Private wardrobe ownership

Given Customer A uploaded a wardrobe item with manual metadata
When Customer B requests the item, its metadata, or a media URL outside a shared look
Then access is denied and no private object key or signed URL is disclosed.

### AC-C08 Wardrobe deletion

Given an owned wardrobe item is referenced by a saved look
When the owner deletes the item
Then new media access is revoked immediately, the look reference is removed or
tombstoned, and a failed object deletion is retried without restoring access.

### AC-C09 Saved look lifecycle

Given an owned wardrobe item and an active nearby-shop variant
When the customer creates, renames, duplicates, and deletes a look
Then each operation affects only that customer's resources and the duplicate has a
new UUID with the same ordered composition.

### AC-C10 Expired Group Style invite

Given a private room invite whose UTC expiry has passed
When an authenticated customer opens its link or enters its join code
Then joining fails with `GROUP_INVITE_EXPIRED` and no room content is disclosed.

### AC-C11 Removed Group Style member

Given an active room participant
When the room owner removes that participant
Then the participant immediately loses API, realtime, and new shared-media access
and later room writes fail with `GROUP_MEMBER_REMOVED` or an equivalent denial.

### AC-C12 Duplicate vote

Given a participant has voted `MAYBE` on a shared item
When the participant votes `LOVE` on the same item
Then the existing vote is updated and exactly one effective vote remains.

### AC-C13 Out-of-stock shared product

Given a shared product becomes out of stock at its source shop
When a room member refreshes the room
Then the product remains visible with current integer-paise price and unavailable
status, and add-to-cart is rejected with the applicable stock error.

### AC-C14 Individual Group Style checkout

Given two participants shortlist the same available product
When each adds it from the room and checks out
Then each uses a separate one-shop cart, address, payment, and order; no shared cart,
payment, order, or delivery address is created.

### AC-C15 Room privacy and closure

Given a private room with active members
When a non-member requests it or a retained member tries to mutate it after closure
Then the non-member receives no room content and the closed-room mutation fails with
`GROUP_ROOM_CLOSED`; retained members can only read the closed room.

### AC-C16 Durable activity and abuse-report privacy

Given an active participant submits a comment, vote, shortlist change, and report
When realtime delivery is disconnected
Then each action is durably available after refresh, and the report/reporter identity
is visible only to the reporter and authorized support/admin reviewers.

## Merchant

### AC-M01 Ringtone

Given the merchant is accepting orders  
When a new order is committed  
Then a high-priority push is sent and the foreground app shows a looping urgent alert.

### AC-M02 Acknowledge

Given an active alert  
When the merchant acknowledges it  
Then retries stop and `acknowledged_at` is recorded.

### AC-M03 Accept

Given an order in `WAITING_FOR_MERCHANT`  
When the merchant accepts with preparation time  
Then the state becomes `MERCHANT_ACCEPTED` and history is recorded.

### AC-M04 Reject

Given an order in `WAITING_FOR_MERCHANT`  
When the merchant rejects with a valid reason  
Then the order is cancelled, stock is released, issue is recorded, and refund starts if needed.

### AC-M05 Offline sale

Given sufficient stock  
When an offline sale is submitted  
Then sale and inventory movement are created atomically and stock decreases once.

### AC-M06 Packing

Given an accepted order  
When all items are verified  
Then Ready for Pickup becomes available.

## Captain

### AC-D01 Exclusive assignment

Given one open delivery task  
When two captains accept concurrently  
Then only one is assigned.

### AC-D02 Pickup code

Given an assigned captain at the store  
When the wrong pickup code is entered  
Then pickup is rejected.

### AC-D03 Delivery OTP

Given a captain at the customer  
When the correct OTP is entered  
Then delivery completes and earnings are created.

### AC-D04 COD

Given a COD order  
When delivery completes  
Then expected COD is recorded in captain balance.

## Admin

### AC-A01 Merchant approval

Given a pending merchant  
When an authorized admin approves  
Then the merchant becomes approved and an audit entry is created.

### AC-A02 Manual assignment

Given an unassigned order  
When Operations assigns an available captain  
Then the task is locked, assigned, and all parties are notified.

### AC-A03 Override

Given a sensitive order override  
When the admin omits a reason  
Then the action is rejected.

### AC-A04 Refund

Given an approved return  
When Finance approves the refund  
Then one provider refund is created and duplicate approval is idempotent.

## Security

### AC-S01 Customer isolation

Customer A cannot read Customer B’s order.

### AC-S02 Merchant isolation

Merchant A cannot read or update Merchant B’s product or inventory.

### AC-S03 Captain isolation

A captain cannot view a delivery that is neither offered nor assigned.

### AC-S04 Secret isolation

No production secret/service-role key exists in mobile or web client bundles.
