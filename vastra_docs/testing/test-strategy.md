---
project: Vastra
version: 1.0
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

## 6. Reliability tests

- Restart worker during event processing
- Provider timeout
- Realtime disconnect
- Push failure
- Database connection interruption
- Payment webhook delivered out of order
- Refund provider unavailable
- Retry after app crash

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
