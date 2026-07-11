---
project: Vastra
version: 1.1
status: Frozen MVP
last_updated: 2026-07-11
---

# Vastra Product Requirements Document

## 1. Product summary

Vastra is a hyperlocal fashion-commerce platform connecting customers with nearby clothing and accessory shops. The platform includes:

- Customer mobile application
- Merchant mobile application
- Captain mobile application
- Admin and operations web application
- Shared backend and Supabase platform

The MVP proves one reliable transaction:

> A customer discovers an in-stock nearby fashion item, places an order, the merchant receives a loud ringing alert, the merchant accepts and packs the order, a captain delivers it, and an administrator can monitor and resolve exceptions.

## 2. Target users

### Customer

A person who wants to browse and order fashion products from nearby shops.

### Merchant

A local shop owner using one merchant login to manage products, variants, inventory, orders, offline sales, fulfilment, and support.

### Captain

A delivery partner who receives tasks, picks up orders, delivers them, collects COD when necessary, and records completion.

### Administrator

An internal employee managing merchant approvals, captain approvals, live operations, support, refunds, settlements, and audit activity.

## 3. Product goals

1. Keep online stock aligned with physical shop stock.
2. Deliver urgent merchant order alerts reliably.
3. Make hyperlocal fashion discovery easy.
4. Keep order, payment, inventory, and delivery state consistent.
5. Give operations staff enough control to recover from failures.
6. Test private, manual Wardrobe and Group Style collaboration in the first pilot.
7. Keep future recommendations, size fitting, body scanning, and virtual try-on
   outside the pilot boundary.

## 4. Non-goals for MVP

The first launch does not include:

- Multi-shop cart
- Body scanning
- AI size prediction
- Virtual try-on
- Machine-learning recommendations
- Multiple merchant branches
- Multiple merchant staff roles
- Advanced captain route batching
- Complex dynamic commissions
- Full multi-city operations
- Loyalty points or wallet
- Automatic clothing recognition, background removal, segmentation, outfit
  generation, size measurement, or fit prediction
- Video wardrobe scanning or public wardrobe profiles
- Shared carts, split/shared payments, combined multi-user orders, or multiple
  delivery addresses in one order
- Public/influencer rooms, live video shopping, group rewards, automatic social
  discovery, or AI stylist chat

## 5. Launch assumptions

| Item | MVP decision |
|---|---|
| Initial geography | One limited Tirupati zone |
| Pilot merchants | 5–10 |
| Pilot captains | 5–10 |
| Pilot customers | 100–300 |
| Mobile launch | Android first |
| Admin | Desktop web |
| Cart | One merchant per cart |
| Merchant account | One login, one shop |
| Language | English |
| Currency | INR |
| Money representation | Integer paise |
| Primary database | Supabase PostgreSQL |
| Backend | TypeScript modular monolith |
| Payments | COD + one online provider |
| Dispatch | Automatic offer with admin fallback |

## 6. Customer requirements

### Authentication and account

- Mobile OTP login
- Profile management
- Address management
- Location permission
- Notification permission
- Logout

### Discovery

- Home page with banners
- Nearby shops
- Categories
- Search
- Basic filters
- Shop details
- Product listing
- Product details
- Size chart
- Product variant availability
- Favourite shops

### Commerce

- One-shop cart
- Checkout quote
- COD
- One online payment method
- Order confirmation
- Order timeline
- Captain details
- Delivery ETA
- Delivery OTP
- Cancellation before merchant acceptance

### Post-order

- Return request
- Evidence upload
- Refund status
- Support ticket
- Ratings for product, shop, and captain

### Wardrobe and looks

- Upload one photo for an owned item through private storage
- Manually assign category, colour, occasion, season, and optional notes
- List, view, edit, and delete only the customer's own wardrobe items
- Create looks from owned wardrobe items and nearby-shop products
- Save, rename, duplicate, and delete looks
- Share a saved look into a private Group Style room
- Add currently available shop variants from a look to the customer's own cart
- Show recoverable upload, refresh, deletion, and availability errors
- Provide loading, empty, and accessible interactive states

No automatic recognition or transformation of wardrobe images is required.

### Group Style

- Create and list private rooms
- Invite participants with an expiring link or join code
- Join a room while the invite is valid
- Allow the owner to remove participants and close the room
- Share Vastra products and saved wardrobe looks
- Cast one effective `LOVE`, `MAYBE`, or `SKIP` vote per participant per shared item
- Comment and maintain a shared shortlist
- Refresh product price and availability from the catalogue source
- Keep out-of-stock shares visible but non-purchasable
- Report room content or activity for abuse review
- Use optional realtime updates while storing every durable action
- Add products only to each participant's existing individual, one-shop cart

## 7. Merchant requirements

### Shop operations

- Login
- Shop status
- Accept Online Orders toggle
- Temporary pause
- Test New Order Sound

### Catalogue

- Add and edit product
- Add product images
- Create colour and size variants
- Set SKU and barcode
- Activate or deactivate product

### Inventory

- Variant-level inventory
- Barcode lookup
- Manual product search
- Add stock
- Offline sale
- Return to stock
- Mark damaged
- Stock correction
- Low-stock view
- Inventory history

### Order fulfilment

- Loud ringing new-order alert
- Alert acknowledgement
- Accept or reject order
- Select preparation time
- Report unavailable or damaged item
- Packing checklist
- Item verification
- Mark ready for pickup
- View captain
- Confirm handover

### Business information

- Order history
- Sales summary
- Settlement summary
- Support
- Favourite-shop follower count

## 8. Captain requirements

- OTP login
- KYC and approval status
- Online/offline status
- New delivery offers
- Accept or reject offer
- Pickup navigation
- Merchant contact
- Pickup code
- Customer navigation
- Customer contact
- COD confirmation
- Delivery OTP
- Failed-delivery reasons
- Earnings and payout status
- Support and emergency help

## 9. Admin requirements

### Roles

- Super Admin
- Operations Admin
- Support Admin
- Finance Admin

### Modules

- Dashboard
- Merchant approval
- Captain approval
- Live orders
- Manual captain assignment
- Reassignment
- Cancellations
- Returns
- Refunds
- Payment and settlement overview
- Support tickets
- Product moderation
- Banner and basic coupon management
- Audit logs

## 10. Quality requirements

- Duplicate requests must not create duplicate orders.
- Inventory cannot become negative.
- Two customers cannot purchase the same final unit.
- Two captains cannot accept the same delivery.
- Merchant alerts must be observable and retried.
- Payment webhooks must be idempotent.
- Sensitive actions must be audited.
- Unauthorized cross-user access must fail.
- Mobile applications must not contain Supabase secret/service keys.
- Every critical operation must have a recoverable error state.
- Wardrobe and Group Style cross-customer access must fail unless a room-scoped
  share grants access to an active participant.
- Wardrobe deletion must revoke media access and remove active references.
- Removed members and expired invites must be rejected immediately.

## 11. Success metrics

| Metric | Target |
|---|---:|
| Crash-free sessions | ≥ 99.5% |
| Successful API requests | ≥ 99% |
| Duplicate orders | 0 |
| Negative inventory incidents | 0 |
| Merchant alert delivery | ≥ 98% |
| Unauthorized access tests | 0 failures |
| Payment webhook idempotency | 100% |
| Delivery OTP bypass | 0 unauthorized cases |
| Unauthorized wardrobe or room access | 0 failures |
| Duplicate effective Group Style votes | 0 |

## 12. Change control

The MVP is frozen. A new feature enters only when:

1. It fixes a security, legal, payment, or core transaction problem.
2. It is required to complete the order journey.
3. Another feature of comparable complexity is removed.
4. This document is versioned to a new approved release.
