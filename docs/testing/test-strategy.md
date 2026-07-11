---
project: Vastra
version: 1.1
status: Frozen MVP
last_updated: 2026-07-11
---

# Test Strategy

## 1. Objective

Prevent data corruption, unauthorized access, duplicate financial actions, and broken cross-app workflows.

## 2. Test pyramid

### Unit tests

Test:

- Pricing
- Discounts
- Inventory calculations
- Order transitions
- Cancellation policy
- Return eligibility
- Refund calculations
- Delivery fees
- Alert retry logic
- Permission decisions
- Wardrobe/look ownership and deletion decisions
- Invite expiry, room membership, vote upsert, and shortlist uniqueness
- Product availability refresh and individual-cart enforcement

### Database tests

Test:

- RLS
- Constraints
- Functions
- Triggers
- Row locking
- Idempotency
- Migration forward/rollback
- Seed integrity
- Wardrobe owner RLS, room-member read RLS, and protected-table write denial
- Unique vote/membership/shortlist constraints and invite expiry constraints

### Integration tests

Test:

- Cart to order
- Order to inventory reservation
- Merchant accept/reject
- Alert acknowledgement
- Captain assignment race
- Pickup and delivery OTP
- COD
- Return and refund
- Settlement eligibility
- Webhook deduplication
- Private wardrobe upload/finalize/delete lifecycle
- Look create/duplicate/share and add-to-cart
- Room invite/join/remove/close, share/vote/comment/shortlist/report persistence
- Current product price/stock refresh for look and room reads

### API contract tests

Validate implementation against `api/openapi.yaml`.

### End-to-end tests

Automate:

- Customer COD order
- Customer online-payment order
- Merchant rejection
- Merchant packing
- Captain delivery
- Customer cancellation
- Return and refund
- Admin reassignment
- Wardrobe item and saved-look lifecycle
- Private Group Style invite, participation, removal, and individual checkout

### Device tests

Test:

- Low-end Android
- Current Android
- iPhone build compatibility
- Weak network
- Offline
- Background app
- Killed app
- Battery saver
- Notification denied
- Location denied

## 3. Critical race tests

- Two customers purchase last unit
- Two captains accept one task
- Duplicate order request
- Duplicate webhook
- Merchant accepts after timeout
- Customer cancels while merchant accepts
- Captain completes while admin cancels
- Same inventory adjustment sent twice

## 4. Security tests

- Customer A reads Customer B order
- Merchant A reads Merchant B stock
- Captain reads unassigned task
- Support role tries settlement update
- Marketing role reads KYC
- Service-role key absent from client bundle
- Private storage URL access without signature
- Webhook signature forgery
- File upload content-type bypass
- Cross-customer wardrobe/look reads and signed media access
- Non-member, removed-member, expired-invite, and closed-room mutation attempts
- Direct client writes to protected Wardrobe/Group Style tables
- Abuse-report reporter privacy and room code enumeration resistance

## 5. Performance tests

MVP load targets should be defined from pilot expectations. Test at least:

- Home feed
- Search
- Product detail
- Order placement
- Inventory adjustment
- Merchant alert creation
- Captain assignment
- Live-order dashboard
- Wardrobe list/look detail and Group Style room activity at pilot concurrency

## 6. Reliability tests

- Restart worker during event processing
- Provider timeout
- Realtime disconnect
- Push failure
- Database connection interruption
- Payment webhook delivered out of order
- Refund provider unavailable
- Retry after app crash
- Realtime disconnect/reconnect without losing or duplicating Group Style actions
- Wardrobe object-deletion retry while access remains revoked

## 7. Test data

Provide deterministic fixtures:

- Customer
- Approved merchant and shop
- Product with variants
- Low-stock variant
- Out-of-stock variant
- Approved captain
- Admin roles
- COD order
- Prepaid order
- Return-eligible item
- Two customers with private wardrobe items and saved looks
- Open and closed rooms, active and removed members, valid and expired invites
- Product share with in-stock and out-of-stock variants
- Existing vote and shortlist fixtures for duplicate-action tests

## 8. CI gates

Required for every pull request:

- Lint
- Typecheck
- Unit tests
- Database tests
- Integration tests
- OpenAPI validation
- Build
- Secret scan
- Dependency scan
