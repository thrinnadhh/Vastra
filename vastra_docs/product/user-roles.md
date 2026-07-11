---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# User Roles and Permissions

## 1. Customer

### May

- Manage own profile and addresses
- Browse public shops and products
- Favourite shops
- Manage own cart
- Place own orders
- View own orders
- Request eligible cancellations and returns
- Raise and view own support tickets
- Submit own reviews

### Must not

- View another customer’s information
- Change product prices
- Change inventory
- Assign a captain
- Change payment or refund status
- Access merchant or admin records

## 2. Merchant

One merchant login controls one approved shop in the MVP.

### May

- View and update own shop
- Create and update own products and variants
- Manage own variant inventory through backend operations
- Record own offline sales
- View and fulfil own orders
- Report fulfilment problems
- View own settlements and basic analytics
- Create own offers within policy
- Raise and view own support tickets

### Must not

- Access another shop
- Directly change order payment state
- Directly assign captains
- Modify settlement calculations
- Read private customer data beyond what is required for fulfilment
- Directly update inventory table values from the mobile client

## 3. Captain

### May

- Manage own profile and availability
- View offered delivery tasks
- Accept one available task
- View assigned delivery details
- Submit location during active delivery
- Confirm pickup and delivery
- Record COD
- Report delivery problems
- View own earnings and support

### Must not

- View unrelated deliveries
- Accept an already assigned task
- Change order product details
- Modify payment or merchant settlement records
- Complete delivery without valid proof or approved override

## 4. Super Admin

### May

- Access all admin modules
- Manage admin accounts and roles
- Review audit logs
- Override operations with a recorded reason
- Approve sensitive actions

### Restrictions

- Daily operations should use narrower roles.
- Every sensitive action must be audited.
- Production access should require MFA.

## 5. Operations Admin

### May

- Review merchants and captains
- Monitor orders
- Assign or reassign captains
- Resolve delivery exceptions
- Pause or activate operational accounts
- Add internal notes

### Must not

- Modify payment provider records
- Approve large refunds
- Change protected system security settings

## 6. Support Admin

### May

- Search customers, merchants, captains, and orders
- Read relevant timelines
- Respond to support tickets
- Escalate issues
- Start eligible return or refund workflows

### Must not

- Change settlements
- Access unnecessary KYC fields
- Perform undocumented order-state overrides

## 7. Finance Admin

### May

- Review payments
- Review and approve refunds
- Review merchant settlements
- Review captain payouts
- Reconcile COD
- Retry eligible failed transfers

### Must not

- Modify catalogue or inventory
- Approve own manual adjustment without second approval when configured

## 8. Permission naming

Use resource-action permission codes:

```text
merchant.read
merchant.approve
merchant.suspend
captain.read
captain.approve
order.read
order.assign_captain
order.override_status
return.review
refund.initiate
refund.approve
settlement.read
settlement.adjust
campaign.publish
audit.read
admin.manage_roles
```

## 9. Enforcement layers

Permissions must be enforced in all layers:

1. Supabase RLS for direct database access
2. Backend authorization guard
3. Service-level ownership checks
4. Admin permission checks
5. Audit log for sensitive writes
6. UI hiding for usability only, never as security
