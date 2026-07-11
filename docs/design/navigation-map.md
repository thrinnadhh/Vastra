---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# Navigation Map

## Customer App

Bottom tabs:

```text
Home
Categories
Orders
Favourites
Profile
```

Primary paths:

```text
Home → Shop → Product → Cart → Checkout → Order
Home → Search → Results → Product
Orders → Order Details → Tracking
Orders → Order Details → Return
Profile → Addresses
Profile → Support
```

Post-MVP:

```text
Home → Group Style
Product → Find My Size
Product → Virtual Try-On
```

## Merchant App

Bottom tabs:

```text
Home
Orders
Inventory
Products
More
```

Primary paths:

```text
Home → Ringing Order → Order Details → Accept/Reject
Order Details → Packing → Verification → Ready → Handover
Inventory → Scan/Search → Variant → Action
Products → Add/Edit Product → Variants
More → Offline Sale
More → Settlements
More → Support
```

## Captain App

Bottom tabs:

```text
Home
Orders
Earnings
Support
Profile
```

Primary paths:

```text
Home → Delivery Offer → Accept → Pickup Navigation
Pickup Navigation → Pickup Details → Pickup Code
Pickup → Drop Navigation → Delivery OTP → Complete
Active Delivery → Report Issue
Earnings → Payouts
Support → Ticket/Emergency
```

## Admin Platform

Sidebar:

```text
Dashboard
Orders
Merchants
Captains
Customers
Support
Returns
Finance
Catalogue
Marketing
Audit
Settings
```

Primary paths:

```text
Dashboard → Live Alert → Order Details
Orders → Order Details → Assign/Reassign
Merchants → Merchant → KYC Decision
Captains → Captain → KYC Decision
Support → Ticket → Resolve/Escalate
Returns → Return → Refund
Finance → Settlement/Payout/Refund
Catalogue → Moderation Case
Audit → Event Details
```

## Deep links

Examples:

```text
vastra://product/{productId}
vastra://shop/{shopId}
vastra://order/{orderId}
vastra-merchant://order/{orderId}
vastra-captain://delivery/{deliveryId}
```

All deep links must validate authentication and authorization after opening.
