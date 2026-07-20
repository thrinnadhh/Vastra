# Vastra frontend screen inventory

Status: frozen-MVP implementation boundary
Last reviewed: 2026-07-20

This file translates `docs/design/screen-inventory.md` into route-level frontend
ownership. It does not expand product scope. A visual state such as loading, empty,
permission denied, or payment failure may be a state of a route rather than a separate
route.

## Screen completion contract

Every implemented route or page must define:

- owning application and stable typed route/parameters;
- presentation mode: Brand, Commerce, or Hybrid;
- authentication, role, and authorization requirements;
- OpenAPI operation(s), generated/shared types, and query/cache key;
- valid user actions and duplicate-submission behavior;
- loading, empty where applicable, recoverable error, offline/stale, permission, and
  session-expired states;
- accessibility labels, roles, focus order, dynamic text/zoom, and target sizes;
- approved analytics hooks only;
- unit/component coverage and critical-journey E2E ownership.

Before implementation, label the route `READY`, `CONTRACT-GAP`, or `PLATFORM-GAP` in
the ticket audit. Existing controllers or tables do not replace an OpenAPI contract.

## Customer application

### Root navigation

The authenticated root has exactly five tabs:

| Tab | Root route | Mode | Owns |
|---|---|---|---|
| Home | `Home` | Hybrid | local discovery and editorial entry |
| Discover | `Discover` | Commerce | search, categories, shops, and products |
| Style | `StyleHome` | Hybrid | Wardrobe, saved looks, and private Group Style rooms |
| Orders | `Orders` | Commerce | order history and active-order entry |
| Profile | `Profile` | Commerce | account, addresses, preferences, support, and legal |

Cart is reached from commerce headers/product actions, not a sixth tab. Favourites are
reachable from Discover/Profile. Wardrobe and Group Style live under Style.

### Access and location routes

| Route/surface | Canonical screens | Mode | Current gate |
|---|---|---|---|
| `Splash` | C01 Splash | Brand | platform/session audit |
| `PhoneLogin` | C02 OTP Login | Commerce | existing auth contract |
| `OtpVerification` | C02 OTP Login | Commerce | existing auth contract |
| `ProfileSetup` | C03 Profile Setup | Commerce | verify profile contract |
| `LocationAccess` | C04 Location Permission | Commerce with restrained Brand header | existing location contract |
| `ManualLocation` | C04 manual fallback state | Commerce | existing location contract |

Welcome/onboarding pages may be nested first-launch surfaces, not permanent root tabs.
Permission denied, GPS disabled, service unavailable, bootstrap failure, rate limit,
and session expiry are required states of these routes.

### Discovery, shop, and product routes

| Route/surface | Canonical screens | Mode | Current gate |
|---|---|---|---|
| `Home` | C07 Home | Hybrid | ready/partial sections |
| `Discover` / `Search` | C08 Search | Commerce | ready |
| `SearchResults` | C09 Search Results | Commerce | ready |
| `Filters` | C10 Filters | Commerce | ready |
| `Categories` | C11 Categories | Commerce | ready |
| `NearbyShops` | C12 Nearby Shops | Commerce | ready |
| `ShopDetail` | C13 Shop Details, C14 Product Listing | Commerce | ready |
| `ProductDetail` | C15 Product Details | Commerce | ready |
| `SizeChart` | C16 Size Chart | Commerce | ready if catalogue data supports it |
| `FavouriteShops` | C17 Favourite Shops | Commerce | ready |

Campaigns, occasions, budgets, trends, collections, search suggestions, sorting, image
gallery, and complete-the-look may be composed within these routes only when backed by
real data. Reviews, customer photos, and personalized recommendations are not implied
by the screen inventory.

Required route states include no service area, no nearby shops, closed shop, no search
results, partial section failure, unavailable variant, stale stock/price, media failure,
and cached/offline data where supported.

### Cart, checkout, and order routes

| Route/surface | Canonical screens | Mode | Current gate |
|---|---|---|---|
| `Cart` | C18 Cart | Commerce | ready; preserve tested one-shop behavior |
| `AddressList` | C05 Address List | Commerce | contract gap: HTTP CRUD |
| `AddressForm` | C06 Add/Edit Address | Commerce | contract gap: HTTP CRUD |
| `Checkout` | C19 Checkout | Commerce | quote/COD ready |
| `Payment` | C20 Payment | Commerce | online contract/state-machine reconciliation |
| `OrderConfirmation` | C21 Order Confirmation | Brand moment in Commerce | COD ready |
| `Orders` | C22 Orders | Commerce | ready; preserve current session behavior |
| `OrderDetail` | C23 Order Details | Commerce | ready |
| `OrderTracking` | C24 Order Tracking | Commerce | ready/partial live-location behavior |
| `CancelOrder` | C25 Cancellation | Commerce | contract gap |
| `ReturnRequest` | C26 Return Request, C27 Return Evidence | Commerce | OpenAPI reconciliation required |
| `ReturnStatus` | C28 Return/Refund Tracking | Commerce | OpenAPI reconciliation required |

One-shop warning, empty cart, quote failure, stock/price change, fee breakdown, coupon,
COD confirmation, payment processing/failure/unknown, order-placement progress, order
timeline, delivery OTP, failed delivery, inspection, and refund failure are route states
or nested sheets unless navigation/back-stack behavior requires a typed subroute.

### Profile, trust, and support routes

| Route/surface | Canonical screens | Mode | Current gate |
|---|---|---|---|
| `SupportTickets` | C29 Support Tickets | Commerce | contract gap |
| `SupportConversation` | C30 Ticket Conversation | Commerce | contract gap |
| `Rating` | C31 Ratings | Commerce | contract gap |
| `Profile` / `ProfileEdit` | C32 Profile and Settings | Commerce | verify existing profile contract |
| `SavedAddresses` | C05–C06 | Commerce | contract gap: HTTP CRUD |
| `Preferences` | C32 settings | Commerce | partial |
| `NotificationSettings` | C32 settings | Commerce | platform/contract audit |
| `Legal` | C32 settings | Commerce | content dependency |
| `AccountDeletion` | C32 settings | Commerce | contract gap |

Logout is a confirmed action, not a destination. Destructive account deletion must be
server-authorized and must not be faked through local session removal.

### Style, Wardrobe, and saved-look routes

| Route/surface | Canonical screens | Mode | Current gate |
|---|---|---|---|
| `StyleHome` | C33 Style Hub | Hybrid | ready after navigation foundation |
| `Wardrobe` | C34 Wardrobe List/Empty | Hybrid | existing capability; audit first |
| `WardrobeItemForm` | C35 Add/Edit Wardrobe Item | Commerce | existing capability; private media rules |
| `WardrobeItem` | C36 Item Details/Delete | Commerce | existing capability |
| `SavedLooks` | C37 Saved Looks | Commerce | existing capability |
| `LookForm` | C38 Create/Edit Look | Commerce | existing capability |
| `LookDetail` | C39 Detail/Share/Add to Cart | Hybrid | existing/partial sharing and cart behavior |

Upload, purchased-item selection, category filtering, media retry, private visibility,
duplicate/rename/delete, product availability refresh, and one-shop-cart conflicts are
states or actions within these routes. Wardrobe items are private by default. Sharing a
look never grants browse access to the owner's Wardrobe.

### Private Group Style room routes

| Route/surface | Canonical screens | Mode | Current gate |
|---|---|---|---|
| `GroupStyleRooms` | C40 Group Style Rooms | Commerce | backend contract gap |
| `GroupStyleCreate` | C41 Create Room/Invite | Commerce | backend contract gap |
| `GroupStyleJoin` | C42 Join Group Room | Commerce | backend contract gap |
| `GroupStyleRoom` | C43 Room Activity, C44 Share/Comments/Votes/Shortlist | Hybrid | backend contract gap |
| `GroupStyleMembers` | C45 Members/Close Room | Commerce | backend contract gap |
| `GroupStyleReport` | C46 Report Activity | Commerce | backend contract gap |

The MVP room model supports invitation link/join code, approved membership, product or
saved-look sharing, comments, `LOVE`/`MAYBE`/`SKIP` votes, shared shortlist, abuse
reporting, owner removal/closure, and individual checkout. It does not include events,
dress codes, readiness tracking, shared carts, split payment, public discovery, or
automatic access to member wardrobes.

## Merchant application

All merchant routes use Commerce/operational mode.

| Route group | Canonical screens | Current gate |
|---|---|---|
| Access/readiness | M01 Login, M02 Approval, M04 Shop Status, M05 Notification Setup, M06 Ringtone | partial; preserve tested notification diagnostics |
| Home/orders | M03 Dashboard, M07–M16 ringing through order list | core fulfilment ready; preserve alert/ack/countdown behavior |
| Products | M17–M21 product, images, variants, SKU/barcode | API ready |
| Inventory | M22–M28 list, lookup/scan, action, movements, low stock | API ready |
| Offline sale | M29 Offline Sale | API ready; idempotency required |
| Returns | M30 Returns | implementation/OpenAPI reconciliation required |
| Insights/finance | M31 Sales, M32 Settlements, M33 Followers | self-service contracts partial/gap |
| Support/profile | M34 Support plus shop profile/hours | contracts partial/gap |

Urgent alert, accept/reject, preparation, packing, ready, and handover must remain large,
high-attention, and state-accurate. Decoration is prohibited in active operational work.

## Captain application

All captain routes use Commerce/operational mode.

| Route group | Canonical screens | Current gate |
|---|---|---|
| Access/readiness | D01 OTP, D02 KYC, D03 Approval | partial/gap |
| Home/availability | D04 Online Toggle | core ready; preserve location freshness behavior |
| Offer/pickup | D05–D09 Offer through Merchant Delay | COD core ready |
| Drop/completion | D10–D14 Drop, Arrival, COD, OTP, Failed Delivery | COD core ready; prepaid completion gap |
| Earnings/history | D15 Earnings, D16 Delivery History, D17 Payout | self-service contract gap/partial |
| Support/safety | D18 Support, D19 Emergency | contract gap/partial |

GPS disabled, permission denied, outside service area, weak network, offer expired/taken,
code failure/lockout, customer unavailable, address issue, vehicle problem, unsafe
situation, COD failure, and retry/unknown outcomes are required states.

## Admin platform

All admin pages use Commerce/operational mode with permission-aware navigation,
keyboard support, and mandatory audit/reason behavior for privileged actions.

| Route/page group | Canonical screens | Current gate |
|---|---|---|
| `/login`, `/mfa/*` | A01 Login + MFA | auth/MFA contract audit |
| `/dashboard`, `/orders`, `/orders/[orderId]` | A02–A05 dashboard, live orders, detail, assignment | core partial/ready |
| `/merchants/*` | A06–A08 list, detail, KYC review | contract gap/partial |
| `/captains/*` | A09–A11 list, detail, KYC review | contract gap/partial |
| `/customers` | A12 Customer Search | contract gap |
| `/support/*` | A13–A14 Support Queue/Detail | contract gap |
| `/returns/*`, `/refunds/*` | A15–A17 Returns/Refunds | implementation/OpenAPI reconciliation |
| `/finance/*` | A18–A20 Payments/Settlements/COD | partial; contract every action |
| `/catalogue/moderation` | A21 Catalogue Moderation | contract gap |
| `/marketing/banners`, `/marketing/coupons` | A22–A23 Banners/Coupons | contract gap |
| `/audit` | A24 Audit Logs | partial/ready |
| `/admin-users` | A25 Admin Users/Roles | contract gap |

Existing controllers that are absent or stale in OpenAPI are not frontend-ready. Tables
require server pagination/filtering, semantic statuses, accessible headers, loading,
empty/error states, and a keyboard-safe detail path.

## Explicit post-MVP inventory

Do not add routes or placeholders for:

- Vastra Couple;
- event-based Groups, dress codes, palettes, readiness, or group shopping lists;
- a separate customer website;
- Find My Size, AI size prediction, body scanning, virtual try-on, automatic wardrobe
  recognition, or advanced/ML recommendations;
- public wardrobe/group discovery, shared carts, or split payments.

## Critical E2E ownership

### Customer COD

Login/location → Home/search → shop → product → cart → address → quote → COD →
confirmation → order tracking

### Merchant fulfilment

Background/foreground urgent alert → accept → preparation → pack/verify → ready →
handover

### Captain delivery

Online → offer → accept → pickup code → pickup → delivery OTP → COD confirm → complete

### Admin recovery

Dashboard → supported search → order timeline → authorized recovery → mandatory reason
→ audit record

### Wardrobe/saved look

Add private item → create/edit look → refresh shop item → add eligible product to cart
→ share only the approved look

### Group Style room

Create → invite/join → share product/look → comment/vote → shortlist → individual cart
→ report/close and revoke access
