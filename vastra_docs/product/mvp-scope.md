---
project: Vastra
version: 1.0
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

- Group Style
- ML recommendations
- Camera body scan
- AI size prediction
- Virtual try-on
- AI fashion assistant

## Release boundary

The MVP must not be expanded during implementation without a documented scope trade-off.
