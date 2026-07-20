---
project: Vastra
version: 1.3
status: Frozen MVP
last_updated: 2026-07-21
---

# Navigation map

Navigation is typed and role-aware. Opening any route or deep link must revalidate the
current session, role, resource authorization, and resource state. A hidden client link
is never an authorization boundary.

FE-G0-03 decision: approved as a documentation contract. Runtime implementation remains
a `PLATFORM-GAP` owned by `FE-S02-02`, `FE-S03-01`, `FE-S03-02`, `FE-S03-06`, and
`FE-S03-07`. This document does not register routes or replace the temporary customer
Checkout/Orders switch.

## Customer application

### Frozen root and ownership model

```text
CustomerRoot
├── AccessFlow
│   ├── Splash / first-launch welcome
│   ├── Phone login → OTP
│   ├── Profile setup
│   └── Location permission → manual fallback / service unavailable
├── MainTabs
│   ├── Home → HomeStack
│   ├── Discover → DiscoveryStack
│   ├── Style → StyleStack
│   ├── Orders → OrdersStack
│   └── Profile → ProfileStack
└── TransactionStack
    ├── Cart
    ├── Address selection/form
    ├── Checkout / Payment
    └── Order confirmation
```

The bottom bar has exactly five labelled destinations and typed tab keys:

| Label | Tab key | Initial screen | Stable owner |
|---|---|---|---|
| Home | `Home` | `Home` | `HomeStack` |
| Discover | `Discover` | `Discover` | `DiscoveryStack` |
| Style | `Style` | `StyleHome` | `StyleStack` |
| Orders | `Orders` | `Orders` | `OrdersStack` |
| Profile | `Profile` | `Profile` | `ProfileStack` |

`Cart` is not a sixth tab. It is a contextual full-screen destination in
`TransactionStack`, reachable from commerce headers and eligible product/look/room
actions. Favourites belong to `DiscoveryStack`; support belongs to `ProfileStack` even
when an order supplies context. A route has one canonical owner so entry from another
tab or a deep link cannot create a second route identity.

When Home opens a shop or product, navigation selects `Discover` and pushes the
canonical `DiscoveryStack` destination. When an order opens support, navigation selects
`Profile` and pushes the canonical support destination with an optional owned `orderId`.
Style commerce may open `Cart` without turning Cart into a Style child or tab.

### Typed route contract

The declarations below are the language-neutral TypeScript shape that `FE-S03-01` must
implement in the selected navigation library. Names and required parameters are frozen;
implementation-specific navigator wrapper types are not.

```ts
type UUID = string & { readonly __brand: 'UUID' };
type LegalDocumentKey = string & { readonly __brand: 'LegalDocumentKey' };
type SensitiveIngressHandle = string & { readonly __brand: 'SensitiveIngressHandle' };

type CustomerTabParamList = {
  Home: undefined;
  Discover: undefined;
  Style: undefined;
  Orders: undefined;
  Profile: undefined;
};

type AccessFlowParamList = {
  Splash: undefined;
  PhoneLogin: undefined;
  OtpVerification: undefined;
  ProfileSetup: undefined;
  LocationAccess: undefined;
  ManualLocation: {
    reason?: 'PERMISSION_DENIED' | 'GPS_DISABLED' | 'OUTSIDE_SERVICE_AREA';
  };
};

type HomeStackParamList = {
  Home: undefined;
};

type DiscoveryStackParamList = {
  Discover: undefined;
  Search: { initialQuery?: string } | undefined;
  SearchResults: { query: string };
  Filters: { source: 'SEARCH_RESULTS' | 'SHOP_PRODUCTS' | 'CATEGORY' };
  Categories: undefined;
  NearbyShops: undefined;
  ShopDetail: { shopId: UUID };
  ProductDetail: { productId: UUID };
  SizeChart: { productId: UUID };
  FavouriteShops: undefined;
};

type AddressListParams =
  | { mode: 'MANAGE' }
  | { mode: 'SELECT_FOR_CHECKOUT'; returnTo: 'Checkout' };

type AddressFormParams =
  | { mode: 'CREATE'; purpose: 'MANAGE' | 'CHECKOUT' }
  | { mode: 'EDIT'; purpose: 'MANAGE' | 'CHECKOUT'; addressId: UUID };

type TransactionStackParamList = {
  Cart: undefined;
  AddressList: AddressListParams;
  AddressForm: AddressFormParams;
  Checkout: { addressId?: UUID } | undefined;
  Payment: undefined;
  OrderConfirmation: { orderId: UUID };
};

type OrdersStackParamList = {
  Orders: undefined;
  OrderDetail: { orderId: UUID };
  OrderTracking: { orderId: UUID };
  CancelOrder: { orderId: UUID };
  ReturnRequest: { orderId: UUID };
  ReturnStatus: { returnId: UUID };
  Rating: { orderId: UUID };
};

type ProfileStackParamList = {
  Profile: undefined;
  ProfileEdit: undefined;
  Preferences: undefined;
  NotificationSettings: undefined;
  SupportTickets: { orderId?: UUID } | undefined;
  SupportConversation: { supportCaseId: UUID };
  Legal: { document: LegalDocumentKey };
  AccountDeletion: undefined;
};

type WardrobeItemFormParams =
  | { mode: 'CREATE' }
  | { mode: 'EDIT'; wardrobeItemId: UUID };

type LookFormParams =
  | { mode: 'CREATE' }
  | { mode: 'EDIT'; lookId: UUID };

type GroupStyleJoinParams =
  | { method: 'LINK'; ingressHandle: SensitiveIngressHandle }
  | { method: 'JOIN_CODE_ENTRY' };

type StyleStackParamList = {
  StyleHome: undefined;
  Wardrobe: undefined;
  WardrobeItemForm: WardrobeItemFormParams;
  WardrobeItem: { wardrobeItemId: UUID };
  SavedLooks: undefined;
  LookForm: LookFormParams;
  LookDetail: { lookId: UUID };
  GroupStyleRooms: undefined;
  GroupStyleCreate: undefined;
  GroupStyleJoin: GroupStyleJoinParams;
  GroupStyleRoom: { roomId: UUID };
  GroupStyleMembers: { roomId: UUID };
  GroupStyleReport: { roomId: UUID; shareId?: UUID; commentId?: UUID };
};
```

Route params carry identity and safe navigation intent only. They never carry prices,
inventory, order/payment/return status, authorization decisions, OTPs, phone numbers,
addresses, signed media URLs, or provider state. Those values come from authoritative
session/API state. `OtpVerification` keeps its challenge context in the in-memory auth
flow rather than route params. `Legal.document` must be checked against the approved
content allowlist before navigation; arbitrary URLs or HTML are forbidden.

`Filters`, `SizeChart`, `CancelOrder`, `AccountDeletion`, and `GroupStyleReport` may be
presented as a sheet/dialog on a capable platform, but retain the route names and params
above. Presentation does not create a second modal-only route identity.

### Frozen customer route ownership and gates

| Route/surface | Canonical screens | Owner | Parameters | FE-G0-02 disposition |
|---|---|---|---|---|
| `Splash` | C01 | Access flow | none | `PLATFORM-GAP`: `FE-S03-02` |
| `PhoneLogin`, `OtpVerification` | C02 | Access flow | none; auth context stays in memory | `PLATFORM-GAP`: `FE-S03-03` |
| `ProfileSetup` | C03 | Access flow | none | `CONTRACT-GAP`: `BE-FE-001`; UI `FE-S03-05` |
| `LocationAccess`, `ManualLocation` | C04 | Access flow | optional safe reason | `PLATFORM-GAP`: `FE-S03-04` |
| `Home` | C07 | Home tab / `HomeStack` | none | `PLATFORM-GAP`: `FE-S02-02`, `FE-S04-01` |
| `Discover`, `Search` | C08 | Discover tab / `DiscoveryStack` | optional initial query | `PLATFORM-GAP`: `FE-S02-02`, `FE-S04-02` |
| `SearchResults` | C09 | `DiscoveryStack` | `query` | `PLATFORM-GAP`: `FE-S02-02`, `FE-S04-02` |
| `Filters` | C10 | `DiscoveryStack` modal/sheet | allowlisted source | `PLATFORM-GAP`: `FE-S02-02`, `FE-S04-02` |
| `Categories` | C11 | `DiscoveryStack` | none | `PLATFORM-GAP`: `FE-S02-02`, `FE-S04-01`, `FE-S04-02` |
| `NearbyShops` | C12 | `DiscoveryStack` | none | `PLATFORM-GAP`: `FE-S02-02`, `FE-S04-03` |
| `ShopDetail` | C13–C14 | `DiscoveryStack` | `shopId` | `PLATFORM-GAP`: `FE-S02-02`, `FE-S04-03` |
| `ProductDetail` | C15 | `DiscoveryStack` | `productId` | `PLATFORM-GAP`: `FE-S02-02`, `FE-S04-04` |
| `SizeChart` | C16 | `DiscoveryStack` modal/sheet | `productId` | `CONTRACT-GAP`: `BE-FE-003` |
| `FavouriteShops` | C17 | `DiscoveryStack` | none | `PLATFORM-GAP`: `FE-S02-02`, `FE-S04-05` |
| `Cart` | C18 | `TransactionStack` | none | `PLATFORM-GAP`: `FE-S02-02`, `FE-S05-01` |
| `AddressList` | C05 | `TransactionStack`; Profile is an entry point | discriminated manage/select params | `CONTRACT-GAP`: `BE-FE-002`; UI `FE-S05-02` |
| `AddressForm` | C06 | `TransactionStack` | discriminated create/edit params | `CONTRACT-GAP`: `BE-FE-002`; UI `FE-S05-02` |
| `Checkout` | C19 | `TransactionStack` | optional owned `addressId` | quote is `PLATFORM-GAP`; coupon is `BE-FE-026` |
| `Payment` | C20 | `TransactionStack` | none; server state is authoritative | COD `PLATFORM-GAP`; online `BE-FE-005` |
| `OrderConfirmation` | C21 | `TransactionStack` | `orderId` | `PLATFORM-GAP`: `FE-S02-02`, `FE-S05-04`, `FE-S05-05` |
| `Orders` | C22 | Orders tab / `OrdersStack` | none | `PLATFORM-GAP`: `FE-S02-02`, `FE-S05-05` |
| `OrderDetail` | C23 | `OrdersStack` | `orderId` | `PLATFORM-GAP`: `FE-S02-02`, `FE-S05-05` |
| `OrderTracking` | C24 | `OrdersStack` | `orderId` | `PLATFORM-GAP`: `FE-S02-02`, `FE-S05-05` |
| `CancelOrder` | C25 | `OrdersStack` modal/sheet | `orderId` | `CONTRACT-GAP`: `BE-FE-004`; UI `FE-S09-01` |
| `ReturnRequest` | C26–C27 | `OrdersStack` | `orderId`; evidence remains route state | `CONTRACT-GAP`: `BE-FE-006`; UI `FE-S10-04` |
| `ReturnStatus` | C28 | `OrdersStack` | `returnId` | `CONTRACT-GAP`: `BE-FE-006`; UI `FE-S10-06` |
| `Rating` | C31 | `OrdersStack` | `orderId` | `CONTRACT-GAP`: `BE-FE-008`; UI `FE-S09-03` |
| `SupportTickets` | C29 | `ProfileStack`; Orders may supply context | optional owned `orderId` | `CONTRACT-GAP`: `BE-FE-007`; UI `FE-S09-02` |
| `SupportConversation` | C30 | `ProfileStack` | `supportCaseId` | `CONTRACT-GAP`: `BE-FE-007`; UI `FE-S09-02` |
| `Profile`, `ProfileEdit` | C32 | Profile tab / `ProfileStack` | none | read `PLATFORM-GAP`; update `BE-FE-001` |
| `Preferences` | C32 | `ProfileStack` | none | `PLATFORM-GAP`: `FE-S02-02`, `FE-S09-04` |
| `NotificationSettings` | C32 | `ProfileStack` | none | `CONTRACT-GAP`: `BE-FE-009`; UI `FE-S09-04` |
| `Legal` | C32 | `ProfileStack` | approved `document` key | `PLATFORM-GAP`: content registry in `FE-S09-04` |
| `AccountDeletion` | C32 | `ProfileStack` modal/dialog | none | `CONTRACT-GAP`: `BE-FE-001`; UI `FE-S09-04` |
| `StyleHome` | C33 | Style tab / `StyleStack` | none | `PLATFORM-GAP`: `FE-S03-01`, `FE-S14-01` |
| `Wardrobe` | C34 | `StyleStack` | none | `PLATFORM-GAP`: `FE-S02-02`, `FE-S14-02` |
| `WardrobeItemForm` | C35 | `StyleStack` | discriminated create/edit params | `PLATFORM-GAP`: `FE-S02-02`, `FE-S14-03` |
| `WardrobeItem` | C36 | `StyleStack` | `wardrobeItemId` | `PLATFORM-GAP`: `FE-S02-02`, `FE-S14-02`, `FE-S14-03` |
| `SavedLooks` | C37 | `StyleStack` | none | `PLATFORM-GAP`: `FE-S02-02`, `FE-S14-04` |
| `LookForm` | C38 | `StyleStack` | discriminated create/edit params | `PLATFORM-GAP`: `FE-S02-02`, `FE-S14-04` |
| `LookDetail` | C39 | `StyleStack` | `lookId` | core `PLATFORM-GAP`; private share `BE-FE-010` |
| `GroupStyleRooms` | C40 | `StyleStack` | none | `CONTRACT-GAP`: `BE-FE-011`, `FE-S15-01` |
| `GroupStyleCreate` | C41 | `StyleStack` | none | `CONTRACT-GAP`: `BE-FE-011`, `FE-S15-01`, `FE-S15-02` |
| `GroupStyleJoin` | C42 | Link ingress → `StyleStack` | sensitive link token or code-entry mode | `CONTRACT-GAP`: `BE-FE-011`, `FE-S15-01`, `FE-S15-02` |
| `GroupStyleRoom` | C43–C44 | `StyleStack` | `roomId` | `CONTRACT-GAP`: `BE-FE-011`, `FE-S15-01`, `FE-S15-03`, `FE-S15-04` |
| `GroupStyleMembers` | C45 | `StyleStack` | `roomId` | `CONTRACT-GAP`: `BE-FE-011`, `FE-S15-01`, `FE-S15-05` |
| `GroupStyleReport` | C46 | `StyleStack` modal/sheet | `roomId`, optional target IDs | `CONTRACT-GAP`: `BE-FE-011`, `FE-S15-01`, `FE-S15-05` |

Every frozen customer screen C01–C46 has one owner above. C14 product listing is the
catalogue section of `ShopDetail`; C27 evidence is a protected state inside
`ReturnRequest`; profile-managed addresses enter the canonical `AddressList` rather
than registering `SavedAddresses` as a duplicate route.

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

Routes marked `CONTRACT-GAP` are not registered as production destinations and have no
visible navigation action until the named backend ticket and shared contract pass.
Routes marked `PLATFORM-GAP` may be implemented only by their named roadmap tickets.
Documentation of a route is not permission to expose it.

The temporary Checkout/Orders root switch must remain reachable until `FE-S03-06`
migrates it behind the typed stacks with regression coverage.

### Follow-up ownership

| Ticket | Required navigation outcome |
|---|---|
| `FE-S02-02` | Supply generated/shared UUID and API resource types; route files must not duplicate API models. |
| `FE-S03-01` | Implement the frozen names/params, five tabs, link parser, canonical stack ownership, and unavailable-link surfaces. |
| `FE-S03-02` | Own bootstrap, refresh, sign-out, role resolution, and in-memory pending-destination continuation. |
| `FE-S03-03` | Implement the OTP flow without placing phone, OTP, or challenge secrets in route state. |
| `FE-S03-04` | Own location/manual/serviceability guards used by discovery and transaction destinations. |
| `FE-S03-05` | Implement profile readiness without client-authored completion and unblock only after `BE-FE-001`. |
| `FE-S03-06` | Replace the temporary Checkout/Orders switch without losing either tested flow. |
| `FE-S03-07` | Test tab state, valid/invalid links, wrong-role denial, authorization failure, session expiry, continuation, and back behavior. |
| `FE-S09-04` | Freeze the legal-content key allowlist before `Legal` is registered. |

The route-level backend dependencies are the existing `BE-FE-001` through
`BE-FE-011` and `BE-FE-026` entries cited above. FE-G0-03 creates no additional backend
ticket because no navigation-only backend capability is missing.

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

### Scheme ownership

| Scheme | Owning application | Accepted account type | Frozen paths |
|---|---|---|---|
| `vastra://` | Customer mobile app | `CUSTOMER` | customer allowlist below |
| `vastra-merchant://` | Merchant mobile app | `MERCHANT` | `order/{orderId}` only |
| `vastra-captain://` | Captain mobile app | `CAPTAIN` | `delivery/{deliveryId}` only |
| Admin HTTPS origin | Admin web app | `ADMIN` plus MFA/permission | permission-aware web routes only |

An application rejects every other scheme, host, and path before route resolution. A
merchant, captain, or admin session presented to the customer app never enters
`MainTabs`, even if the resource identifier is valid. It clears the pending customer
destination and renders the existing role-mismatch/access-denied recovery. The same
rule applies in reverse. Opening the correct application is an explicit user action,
not an automatic cross-role redirect carrying resource data.

Admin links are ordinary HTTPS routes on the approved admin origin; the customer app
does not claim or translate them. Client-side scheme separation is defence in depth,
not authorization: every destination still requires server role, ownership, resource,
state, and, for admin, MFA/permission checks.

### Customer allowlist

| Link pattern | Typed target | Required checks | Availability |
|---|---|---|---|
| `vastra://product/{productId}` | `Discover → ProductDetail({ productId })` | valid UUID, customer session/role, active approved product | approved mapping; runtime `FE-S03-01`, `FE-S03-07`; shared types `FE-S02-02` |
| `vastra://shop/{shopId}` | `Discover → ShopDetail({ shopId })` | valid UUID, customer session/role, active shop, serviceable location | approved mapping; runtime `FE-S03-01`, `FE-S03-04`, `FE-S03-07` |
| `vastra://order/{orderId}` | `Orders → OrderDetail({ orderId })` | valid UUID, customer session/role, owned order | approved mapping; runtime `FE-S03-01`, `FE-S03-07`; shared types `FE-S02-02` |
| `vastra://look/{lookId}` | `Style → LookDetail({ lookId })` | valid UUID, customer session/role, owned active look | approved mapping; runtime `FE-S03-01`, `FE-S03-07`, `FE-S14-04`, `FE-S14-05` |
| `vastra://group-style/join/{inviteToken}` | link ingress stores token in memory → `GroupStyleJoin({ method: 'LINK', ingressHandle })` | syntactic token check, customer auth, backend invite expiry/revocation/membership validation | reserved until `BE-FE-011`, `FE-S15-01`, `FE-S15-02` |
| `vastra://group-style/rooms/{roomId}` | `Style → GroupStyleRoom({ roomId })` | valid UUID, customer auth, active/retained membership and room state | reserved until `BE-FE-011`, `FE-S15-01`, `FE-S15-03`, `FE-S15-05` |

This is an allowlist, not a general `routeName + params` decoder. Cart, address,
checkout, payment, confirmation, cancellation, returns, support, ratings, profile
mutation, Wardrobe-item media, and account deletion have no MVP deep-link path. They
require trusted in-app state or an explicit future contract decision. A bare application
open runs `Splash` and then restores the last safe tab/default `Home`; it does not replay
the last mutation screen.

The Group Style invite token is a bearer secret. It may exist only in the OS-delivered
URL and an in-memory secret store owned by link/auth ingress. The typed navigation state
receives an opaque `SensitiveIngressHandle`, never the token. Neither value is written
to navigation persistence, analytics, crash reports, logs, clipboard history controlled
by the app, or query/cache keys. Clear the handle and token after join success, terminal
rejection, role mismatch, sign-out, or app restart. If the process is lost during OTP,
the customer must reopen the invitation.

### Resolution and post-login continuation

Deep-link handling order is frozen as:

```text
Match an allowlisted scheme and path
→ parse and validate untrusted parameters
→ store one sanitized pending destination in memory
→ bootstrap or refresh the session
→ if signed out, run PhoneLogin → OtpVerification without serializing the destination
→ resolve account type/status and require CUSTOMER
→ complete mandatory profile/location gates only when the destination requires them
→ re-parse the pending destination and fetch authoritative resource state
→ verify ownership/membership and business state on the server
→ replace auth/link ingress with the canonical tab root + destination
→ clear pending data
```

Only one pending destination exists. A newer explicit link replaces an older one. It is
cleared on sign-out, role mismatch, terminal invalidity, or successful navigation. It
must not survive application restart, and it must never retain a mutation payload.

Product and shop links wait for the `FE-S03-04` location/serviceability gate after
authentication. Order and owned-look links do not invent a location requirement.
Profile setup is applied only when the account readiness contract requires it; a client
must not mark profile completion locally to reach a destination.

### Recovery and back-stack contract

| Failure | Required result |
|---|---|
| Unknown scheme/path, malformed UUID, malformed invite token | Render invalid-link recovery; offer the safe signed-in tab root or sign-in entry. Do not attempt a network mutation. |
| Signed out | Preserve the sanitized in-memory destination through OTP and continue once; back exits auth according to platform convention, not into protected content. |
| Authenticated as merchant, captain, or admin | Render role mismatch/access denied, clear pending data, and never construct a customer stack. |
| Suspended/disabled/not-ready account | Render the authoritative account-status recovery and clear any destination that must not continue. |
| `401` during resolution | Refresh once through the session boundary; on failure return to sign-in and retain no sensitive token. |
| `403` or ownership/membership denial | Render a generic unavailable result without confirming another user's resource exists. |
| `404`, deleted, inactive, revoked, expired, removed, or unsupported state | Render truthful unavailable/expired recovery with a path to the canonical owning tab. |
| Contract-gapped or disabled destination | Do not register or open the feature route; render feature unavailable only through the link ingress and cite its named dependency in diagnostics. |
| Temporary network/service failure | Keep only safe parsed identity in memory, expose retry/cancel, and never show stale mutation success. |

A successful deep link constructs the minimum deterministic stack: canonical tab root,
then the typed destination. It does not synthesize intermediate search, shop, checkout,
or room history. Back returns to the canonical owning root. Auth completion uses replace,
so Back cannot reveal OTP/profile/location gates or a sensitive invite URL.

## Post-MVP exclusions

No MVP navigation entry or placeholder is reserved for Vastra Couple, event-based
Groups, a separate customer website, AI sizing/body scanning, virtual try-on, or public
social discovery.
