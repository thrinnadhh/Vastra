---
project: Vastra
version: 1.1
status: Frozen MVP
last_updated: 2026-07-11
---

# Release Checklist

## 1. Scope

- [ ] MVP scope matches `product/mvp-scope.md`
- [ ] No unapproved feature added
- [ ] Post-MVP features are behind flags or absent
- [ ] Release notes prepared

## 2. Code quality

- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] End-to-end tests pass
- [ ] OpenAPI validates
- [ ] Builds succeed
- [ ] No high-severity dependency vulnerabilities
- [ ] No committed secrets

## 3. Database

- [ ] Migrations tested from empty database
- [ ] Migrations tested on staging copy
- [ ] Backup verified
- [ ] Rollback/forward-fix plan documented
- [ ] RLS enabled
- [ ] RLS tests pass
- [ ] Required indexes exist
- [ ] Seed data excluded from production
- [ ] Service-role access restricted

## 4. Authentication and permissions

- [ ] Customer access tested
- [ ] Merchant isolation tested
- [ ] Captain assignment isolation tested
- [ ] Admin roles tested
- [ ] Admin MFA enabled
- [ ] Suspended accounts blocked
- [ ] Session expiration tested
- [ ] Wardrobe owner and room membership isolation tested
- [ ] Removed members and expired/revoked invites rejected
- [ ] Protected Wardrobe/Group Style tables reject direct client writes

## 5. Storage

- [ ] Public buckets contain only public assets
- [ ] KYC buckets private
- [ ] Return evidence private
- [ ] Wardrobe bucket private and owner-scoped signed upload tested
- [ ] Wardrobe media access after deletion/member removal tested
- [ ] Signed URL expiry tested
- [ ] Upload size/type restrictions tested
- [ ] Malware/content validation process documented

## 6. Customer app

- [ ] OTP
- [ ] Home
- [ ] Search
- [ ] Product variant
- [ ] Cart
- [ ] COD order
- [ ] Online payment order
- [ ] Tracking
- [ ] Cancellation
- [ ] Return
- [ ] Support
- [ ] Wardrobe upload/manual metadata/list/edit/delete and empty state
- [ ] Saved look create/rename/duplicate/delete/share
- [ ] Group room create/invite/join/remove/close and abuse report
- [ ] LOVE/MAYBE/SKIP vote update, comments, and shortlist
- [ ] Current product price/stock refresh and out-of-stock visibility
- [ ] Individual one-shop cart, address, payment, and order from Group Style
- [ ] Error and offline states

## 7. Merchant app

- [ ] Notification permission flow
- [ ] Dedicated new-order channel
- [ ] Custom ringtone
- [ ] Foreground ringing modal
- [ ] Background push
- [ ] Killed-app push
- [ ] Acknowledgement
- [ ] Accept/reject
- [ ] Inventory
- [ ] Offline sale
- [ ] Packing
- [ ] Handover
- [ ] Support

## 8. Captain app

- [ ] Online/offline
- [ ] Offer
- [ ] Exclusive accept
- [ ] Navigation
- [ ] Pickup code
- [ ] Delivery OTP
- [ ] COD
- [ ] Failure reasons
- [ ] Earnings
- [ ] Support

## 9. Admin

- [ ] Merchant approval
- [ ] Captain approval
- [ ] Live orders
- [ ] Assignment/reassignment
- [ ] Support
- [ ] Returns/refunds
- [ ] Finance
- [ ] Audit

## 10. Payments

- [ ] Production credentials configured
- [ ] Webhook signature verified
- [ ] Duplicate webhook tested
- [ ] Out-of-order webhook tested
- [ ] Refund tested
- [ ] Failed refund alert tested
- [ ] COD reconciliation tested

## 11. Observability

- [ ] Error tracking enabled
- [ ] Structured logs enabled
- [ ] Request IDs visible
- [ ] Order IDs searchable
- [ ] Alert delivery metrics visible
- [ ] Payment/refund failure alerting
- [ ] Unassigned order alerting
- [ ] Database health monitoring
- [ ] Wardrobe deletion retry and Group Style durable-action metrics visible

## 12. Operations

- [ ] Support contacts configured
- [ ] Merchant onboarding guide ready
- [ ] Captain guide ready
- [ ] Admin runbook ready
- [ ] Incident owner assigned
- [ ] Rollback owner assigned
- [ ] Pilot merchants confirmed
- [ ] Pilot captains confirmed
- [ ] Limited service zone configured
- [ ] Group Style privacy, membership, retention, and abuse runbook ready

## 13. Go/no-go

Release only when:

- [ ] No critical open defect
- [ ] No unresolved security defect
- [ ] No negative inventory defect
- [ ] No duplicate-order defect
- [ ] Payment and refund flows pass
- [ ] Merchant alerts pass on physical Android devices
- [ ] Admin can recover major failure scenarios
- [ ] Product owner signs off
- [ ] Engineering owner signs off
