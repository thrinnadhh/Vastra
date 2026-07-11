---
project: Vastra
version: 1.1
status: Frozen MVP
last_updated: 2026-07-11
---

# Frozen MVP Scope

## Core promise

The MVP is complete only when this sequence works reliably:

```text
Customer discovers product
→ Customer places order
→ Inventory is reserved
→ Merchant phone rings
→ Merchant accepts and packs
→ Captain accepts and picks up
→ Customer tracks delivery
→ Captain completes delivery using OTP
→ Inventory, earnings, payments, and history remain consistent
```

## Included

### Customer application

- OTP login
- Location and addresses
- Home, categories, nearby shops
- Search and filters
- Shop and product pages
- Size chart
- Favourite shops
- One-shop cart
- COD and one online payment gateway
- Order history and tracking
- Cancellation before merchant acceptance
- Return request
- Support and ratings
- Private wardrobe with customer-uploaded item photos and manual category, colour,
  occasion, season, and optional notes
- Saved looks combining owned wardrobe items and products from nearby Vastra shops
- Create, rename, duplicate, delete, and privately share saved looks
- Private Group Style rooms with link or join-code invitations
- Room membership management, product/look sharing, `LOVE`/`MAYBE`/`SKIP`
  voting, comments, shared shortlist, and abuse reporting
- Individual add-to-cart and checkout from looks and room products

### Merchant application

- Single merchant login
- Shop profile and status
- Product and variant CRUD
- Product images
- SKU and barcode
- Variant inventory
- Barcode and manual inventory lookup
- Offline sales
- Loud incoming-order alert
- Accept/reject order
- Preparation time
- Packing and verification
- Ready for pickup
- Handover confirmation
- Basic sales, settlement, follower, and support views

### Captain application

- OTP login
- KYC and approval status
- Online/offline
- Delivery offers
- Pickup and drop navigation
- Pickup code
- Delivery OTP
- COD recording
- Failed-delivery reasons
- Earnings, history, support

### Admin platform

- Four frozen roles
- Merchant and captain approvals
- Live-order operations
- Manual assignment and reassignment
- Support
- Returns and refunds
- Finance overview
- Product moderation
- Banner and basic coupon management
- Audit logs

### Backend and infrastructure

- Supabase Auth
- PostgreSQL and RLS
- Storage
- Realtime
- TypeScript backend
- Firebase Cloud Messaging
- Payment provider
- Map provider
- Monitoring
- CI/CD
- Idempotency
- Order state machine
- Inventory row locking
- Audit history
- Private wardrobe media with revocable signed access
- Durable Group Style state with optional realtime delivery

## Excluded

### Customer

- Multi-shop cart
- Wallet
- Loyalty points
- Membership
- Live merchant chat
- Exchange workflow
- Scheduled delivery
- BNPL
- Multiple languages
- Public wardrobe profiles

### Merchant

- Multiple staff accounts
- Multiple branches
- AI photo product recognition
- Bulk product import
- Advanced analytics
- Supplier management
- Purchase orders
- Automated barcode printer integration

### Captain

- Multi-order batching
- Heat maps
- Advanced incentives
- Instant withdrawals

### Admin

- Full fraud engine
- Advanced maker-checker
- Multi-city control centre
- Automated field routing
- Complex BI
- Dynamic commission engine

### Future intelligence features

- ML recommendations
- Camera body scan
- AI size prediction
- Virtual try-on
- AI fashion assistant
- Automatic clothing recognition, background removal, or segmentation
- AI-generated outfits
- Automatic size measurement or fit prediction
- Video wardrobe scanning

### Future social and commerce features

- Public groups or public wardrobe discovery
- Influencer rooms
- Shared carts, split/shared payments, or combined multi-user orders
- Multiple delivery addresses in one order
- Live video shopping
- Group rewards or automatic social discovery
- AI stylist chat

## Controlled pilot boundaries

- Wardrobe photos and metadata are private by default. Only the owner can manage
  them; sharing a saved look grants room-scoped access to that look, not access to
  browse the owner's wardrobe.
- Room access is limited to the owner and active participants. Owners can remove
  participants and close rooms; closed rooms are read-only.
- Product price and availability in looks and rooms are refreshed from the source
  product. Out-of-stock products remain visible but cannot be added to cart.
- Every participant retains an individual cart, address, payment, and order. The
  existing one-shop cart rule continues to apply.
- No automatic image understanding or other AI processing is required.

## Release boundary

The MVP must not be expanded during implementation without a documented scope trade-off.
