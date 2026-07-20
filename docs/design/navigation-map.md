---
project: Vastra
version: 1.2
status: Frozen MVP
last_updated: 2026-07-20
---

# Navigation map

Navigation is typed and role-aware. Opening any route or deep link must revalidate the
current session, role, resource authorization, and resource state. A hidden client link
is never an authorization boundary.

## Customer application

### Root structure

```text
Root
├── Launch/Auth stack
│   ├── Splash / first-launch welcome
│   ├── Phone login → OTP
│   ├── Profile setup
│   └── Location permission → manual fallback / service unavailable
└── Authenticated application
    ├── Home
    ├── Discover
    ├── Style
    ├── Orders
    └── Profile
```

The bottom bar has exactly five labelled destinations: Home, Discover, Style, Orders,
and Profile. Cart, favourites, notifications, checkout, and support are contextual
destinations, not extra tabs.

### Primary customer paths

```text
Home → Campaign/Category/Nearby Shop → Shop → Product → Cart
Discover → Search/Category/Filters → Results → Shop/Product
Product → Variant/Size Chart → Cart → Address → Quote → COD/Online Payment → Confirmation
Orders → Order Detail → Tracking / Cancellation / Return / Support
Style → Wardrobe → Item / Saved Looks → Look Detail → Eligible Products → Cart
Style → Group Style Rooms → Create/Join → Room Activity → Shortlist → Individual Cart
Profile → Edit / Addresses / Preferences / Favourite Shops / Support / Legal
Invite Link or Join Code → Authenticate if needed → Validate Invitation → Group Style Room
```

Online payment, cancellation, returns, support, ratings, account deletion, and Group
Style paths remain disabled or hidden until their public API contracts and backend
capabilities pass the corresponding roadmap gate.

### Customer stack ownership

| Stack | Routes |
|---|---|
| Access | Splash, welcome, phone, OTP, profile setup, location/manual/service states |
| Discovery | Home, Discover, search/results/filters, categories, nearby shops, shop, product, size chart, favourites |
| Transaction | Cart, addresses, checkout, payment, confirmation |
| Orders | list, detail, tracking, cancellation, return/evidence/status, support entry |
| Style | Style Home, Wardrobe/item/forms, saved looks/look forms/detail, Group Style rooms/join/activity/members/report |
| Account | profile/edit, addresses, preferences, notifications, support conversation, legal, account deletion |

The temporary Checkout/Orders root switch must remain reachable until `FE-S03-06`
migrates it behind the typed stacks with regression coverage.

## Merchant application

### Root destinations

```text
Home
Orders
Inventory
Products
More
```

### Primary paths

```text
Launch → Login/Approval/Readiness → Home
Background/Foreground Alert → Ringing Order → Details → Accept/Reject
Accepted Order → Preparation → Pack/Verify → Ready → Captain/Handover
Orders → Queue/History → Order Detail
Inventory → Scan/Search → Variant → Adjust/Movement History
Products → Product → Images/Variants/SKU/Barcode
More → Offline Sale / Shop Controls / Returns / Sales / Settlements / Followers / Support
```

The ringing alert may deep-link outside the current tab, but it must preserve countdown,
already-handled, authentication, notification-channel, and device-registration rules.

## Captain application

### Root destinations

```text
Home
Deliveries
Earnings
Support
Profile
```

### Primary paths

```text
Launch → Login/KYC/Approval → Readiness
Home → Online/Offline → Offer → Accept → Active Delivery
Active Delivery → Merchant Navigation → Pickup Details → Pickup Code → Confirm Pickup
Pickup → Customer Navigation → Arrival → Delivery OTP → COD Confirm → Complete
Active Delivery → Supported Failure Reason → Support/Emergency Escalation
Deliveries → History / Delivery Detail
Earnings → Summary / COD Reconciliation / Payout Status
```

The next safe action dominates active delivery. Navigation never exposes customer or
merchant data beyond operational need.

## Admin platform

### Sidebar groups

```text
Operations
├── Dashboard
├── Orders
└── Search

Actors
├── Merchants
├── Captains
└── Customers

Cases and money
├── Support
├── Returns / Refunds
└── Finance / COD

Governance
├── Catalogue moderation
├── Banners / Coupons
├── Audit
├── Admin users / Roles
└── Settings
```

Only routes authorized for the signed-in admin role appear. Server authorization still
controls every read and action.

### Primary admin paths

```text
Dashboard → Live Alert/Queue → Order Detail → Authorized Recovery → Audit Outcome
Search → Order/Merchant/Captain/Customer → Supported Detail
Merchants/Captains → Detail → KYC Decision / Authorized Control
Support → Case → Resolve/Escalate
Returns → Return → Inspection/Admin Review → Refund
Finance → Payment/Settlement/Payout/COD Detail
Catalogue → Moderation Case → Decision
Audit → Event Detail
```

Privileged actions require confirmation, an operational reason when supported/required,
idempotent progress, authoritative refresh, and audit visibility.

## Deep links

```text
vastra://product/{productId}
vastra://shop/{shopId}
vastra://order/{orderId}
vastra://look/{lookId}
vastra://group-style/join/{inviteToken}
vastra://group-style/rooms/{roomId}
vastra-merchant://order/{orderId}
vastra-captain://delivery/{deliveryId}
```

Deep-link handling order:

```text
Parse and validate route parameters
→ bootstrap/refresh session
→ authenticate if needed while preserving a safe pending destination
→ verify role and resource authorization
→ fetch authoritative resource state
→ open the valid destination or a truthful unavailable/recovery screen
```

Tokens and sensitive parameters must not be logged. Invalid, expired, closed, removed,
or already-handled links require explicit recovery states.

## Post-MVP exclusions

No MVP navigation entry or placeholder is reserved for Vastra Couple, event-based
Groups, a separate customer website, AI sizing/body scanning, virtual try-on, or public
social discovery.
