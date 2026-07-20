# Vastra frontend API coverage ledger

Ticket: `FE-G0-02`
Status: documentation-only contract audit
Audit date: 2026-07-20
Audited commit: `3608e45`

## Purpose and boundary

This ledger maps every frozen-MVP frontend screen action in
`docs/design/screen-inventory.md` to the current OpenAPI contract, backend
implementation, authorization/RLS, generated/shared types, and existing tests.

This audit does not change application code, OpenAPI, migrations, RLS, product scope,
or runtime behavior. Proposed `BE-FE-*` identifiers below are exact backend backlog
tickets required to close contract gaps; they are not claims that those tickets already
exist in an external tracker.

## Readiness rules

| Status | Required evidence |
|---|---|
| `READY` | OpenAPI operation, matching backend route/behavior, authorization/RLS, generated/shared client types, and relevant service/integration/database tests all exist. |
| `CONTRACT-GAP` | The public contract or matching backend/security/test slice is missing, incomplete, stale, or contradictory. This takes precedence over a platform gap. |
| `PLATFORM-GAP` | The public contract, backend, authorization/RLS, and backend tests exist, but generated/shared frontend types or required client/platform integration are incomplete. |

No audited action is `READY` under this strict definition because
`packages/api-client/src/index.ts` declares `status: 'not-generated'` and
`packages/domain-types/src/index.ts` exports no domain types. Existing mobile features
use feature-local hand-written types and parsers; those are useful preservation evidence
but are not the approved generated/shared boundary.

## Repository-wide evidence

### Contract-to-controller comparison

| Measure | Count |
|---|---:|
| OpenAPI method/path operations | 119 |
| Nest controller method/path routes | 156 |
| Exact method/path matches | 97 |
| OpenAPI-only operations | 22 |
| Backend-only routes | 59 |
| Incomplete OpenAPI operations | 9 |

The route comparison is syntactic. A matching method/path does not by itself prove
request/response semantic parity.

OpenAPI-only operations are customer cancellation, all 15 Group Style operations, four
legacy admin placeholders, merchant dashboard, and the generic payment webhook.
Backend-only routes are primarily online payment/returns/refunds/finance, merchant
returns, and admin operations. The public health route is also backend-only but has no
frontend screen owner.

The nine incomplete OpenAPI entries have no `operationId`, explicit bearer security, or
typed success schema (the webhook correctly has public security but still lacks an
operation ID/success schema):

- `POST /customer/orders/{orderId}/cancel`;
- `GET /merchant/dashboard`;
- `GET /admin/dashboard`;
- `GET /admin/orders`;
- `POST /admin/orders/{orderId}/assign-captain`;
- `POST /admin/merchants/{merchantId}/approve`;
- `POST /admin/captains/{captainId}/approve`;
- `POST /admin/returns/{returnId}/approve`;
- `POST /webhooks/payments/{provider}`.

### Authorization and RLS baseline

- `AuthenticationGuard`, `AdminMfaGuard`, `AuthorizationGuard`, and
  `OperationalReadinessGuard` are global in `apps/backend/src/auth/auth.module.ts`.
- Feature controllers use `@AllowAccountTypes(...)`; admin controllers additionally use
  `@RequirePermissions(...)` and AAL2 enforcement.
- Core RLS and grants are in
  `supabase/migrations/20260712101437_rls_policies_and_grants.sql`; feature migrations
  add transaction/RPC ownership checks and corresponding SQL tests.
- Customer, merchant, captain, admin, Wardrobe, payment, return, and dispatch modules
  have service/integration tests. Group Style has no backend module, migration, RLS, or
  test evidence.

### Evidence keys used below

| Key | Implementation, security, and tests |
|---|---|
| `E-AUTH` | `apps/backend/src/auth/*`, `apps/backend/src/me/*`, profile/RLS migrations; auth, MFA, authorization, readiness, and `/me` unit/integration tests. |
| `E-DISCOVERY` | customer home, nearby shop, shop detail, catalogue read, product search, and preference controllers/services; SQL tests `0022`–`0026` and matching service/integration tests. |
| `E-CART` | customer cart, checkout quote, and COD order modules; SQL tests `0027`–`0029` and matching service/integration tests. |
| `E-ORDER` | customer/merchant order read and lifecycle modules; SQL tests `0030`–`0035` and service/integration tests. |
| `E-WARDROBE` | `apps/backend/src/wardrobe/*`; SQL tests `0036`–`0043`; upload, item, look, duplicate, resolve, and cart service/integration tests. |
| `E-MCAT` | merchant shop/category/product/variant/image/inventory/offline-sale catalogue modules; SQL tests `0014`–`0021` and matching service/integration tests. |
| `E-ALERT` | merchant order alert/decision/packing/ready plus alert delivery/observability modules; SQL tests `0030`–`0036`, `0044`, `0045`; unit/integration tests. |
| `E-DISPATCH` | captain presence/delivery and admin-delivery modules; SQL tests `0046`, `0047`; service, validation, gateway, worker, and integration tests. |
| `E-ADMIN` | `apps/backend/src/admin/*`; SQL tests `0048`–`0056`; permission, MFA, module-contract, service, and hardening integration tests. |
| `E-FINANCE` | `apps/backend/src/finance/*`; SQL tests `0057`–`0067`, `0090`; payment, return, settlement, COD, payout, refund, webhook, and provider tests. |
| `T-OA` | Typed OpenAPI schemas and backend-local TypeScript types exist; no generated/shared frontend client types. |
| `T-CUSTOMER` | Hand-written customer checkout/order clients, parsers, types, and screen/client tests exist only for the current checkout/order slice. |
| `T-MERCHANT` | Hand-written merchant alert/order clients/types and screen/client tests exist only for the current fulfilment slice. |
| `T-CAPTAIN` | Hand-written captain presence/delivery clients/types and screen/client tests exist only for the current COD delivery slice. |
| `T-NONE` | No generated/shared or app-local client types/tests for the action. |

`E-*` includes the applicable global account-type/readiness guard and RLS/RPC ownership
checks unless a row explicitly states otherwise.

## Exact backend gap tickets

| Ticket | Required backend/contract outcome |
|---|---|
| `BE-FE-001` | Add customer profile update and account-deletion contracts, controllers/services, ownership checks, audit/deletion semantics, OpenAPI schemas, and tests. Keep `/me` as the read contract. |
| `BE-FE-002` | Add customer address list/create/read/update/delete/default contracts with serviceability validation, ownership/RLS, OpenAPI schemas, idempotency where needed, and API/DB tests. |
| `BE-FE-003` | Define product/category size-chart data and a customer read contract with moderation visibility, typed schemas, backend implementation, and tests. |
| `BE-FE-004` | Replace the cancellation placeholder with a real eligibility/cancel service, state-machine enforcement, idempotency, inventory/payment consequences, OpenAPI operation ID/security/schemas, and race/DB tests. |
| `BE-FE-005` | Contract existing online-payment initialization/status/webhook routes, replace the generic webhook mismatch, generate verified payment state schemas, and add a prepaid delivery-completion path consistent with the order state machine and provider tests. |
| `BE-FE-006` | Contract the existing customer return/evidence/status, merchant receipt/inspection, admin decision/pickup, refund/retry/reconcile routes; remove the stale admin-return placeholder; preserve private evidence, permissions, idempotency, and lifecycle tests. |
| `BE-FE-007` | Add customer, merchant, and captain self-service support APIs for list/create/detail/messages/private attachments plus an explicit emergency/escalation path; reuse support RLS and connect admin cases without exposing private actors. |
| `BE-FE-008` | Add delivered-order rating eligibility/submission/read contracts, schema/table/RLS or approved aggregate strategy, duplicate rules, moderation protections, and tests. |
| `BE-FE-009` | Add notification-preference read/update contracts that distinguish mandatory transactional notices from optional marketing, with authorization and tests. |
| `BE-FE-010` | Add private saved-look share/create/read/revoke contracts outside Group Style, scoped media access, expiry/revocation, tombstones, OpenAPI schemas, RLS, and tests. |
| `BE-FE-011` | Implement all contracted Group Style room/invite/join/read/close/member/share/vote/comment/cart/shortlist/report operations with migrations, RLS, private media rules, transactions, rate limits, generated schemas, and authorization/concurrency tests; add authorized report-review access. |
| `BE-FE-012` | Replace the merchant-dashboard placeholder and add merchant shop status/profile/hours update contracts with ownership, readiness rules, typed responses, and tests. |
| `BE-FE-013` | Add a paginated merchant inventory-list read model/contract; keep search, barcode, balance, movement, adjustment, and low-stock contracts authoritative. |
| `BE-FE-014` | Add OpenAPI operations/schemas for the existing merchant return list/detail/receive/inspection implementation and verify route/response parity in contract tests. |
| `BE-FE-015` | Add merchant self-service sales summary, settlement status/history, and follower summary contracts; do not expose follower identities; use integer paise and tests. |
| `BE-FE-016` | Add merchant onboarding/KYC status, private document upload/finalization, submission/resubmission, and admin-review linkage with storage/RLS/security tests. |
| `BE-FE-017` | Add captain onboarding/KYC/profile/vehicle private document contracts and admin-review linkage with storage/RLS/security tests. |
| `BE-FE-018` | Define and implement the terminal failed-delivery/escalation contract after pickup, including allowed reasons, evidence/privacy, order/assignment effects, audit, idempotency, and state-machine tests. |
| `BE-FE-019` | Add captain self-service completed-delivery history, earnings, COD balance/reconciliation status, payout eligibility/history, and profile reads; do not expose admin-only finance operations. |
| `BE-FE-020` | Add OpenAPI operations/schemas/security for all existing admin dashboard/search/investigation/control/case/configuration/audit/finance routes and remove or replace stale admin placeholders; add route-contract parity tests. |
| `BE-FE-021` | Implement a paginated/filterable admin live-order list contract with operational status filters, safe customer fields, permissions, and tests. |
| `BE-FE-022` | Implement paginated/filterable admin merchant and captain list contracts; retain `/admin/search` for supported global lookup and contract it through `BE-FE-020`. |
| `BE-FE-023` | Implement merchant/captain KYC approval/rejection contracts with mandatory reason, four-role permissions, MFA, audit, state validation, OpenAPI schemas, and tests; remove the current OpenAPI-only approval placeholders. |
| `BE-FE-024` | Add admin payment list/detail/status contracts around existing processing/retry behavior, with provider-event privacy, permissions, pagination, and tests. |
| `BE-FE-025` | Add admin catalogue moderation queue/detail/decision contracts with permissions, mandatory reason/audit, product state transitions, and tests. |
| `BE-FE-026` | Add banner and basic coupon CRUD/activation contracts plus customer coupon validation/application in quote/order flows; use integer paise, idempotency/audit where applicable, and tests. |
| `BE-FE-027` | Add admin-user/four-role list/invite/update/disable and permission-review contracts with MFA, least privilege, audit, and tests. |

## Required platform tickets

| Ticket | Outcome |
|---|---|
| `FE-S02-02` | Generate `@vastra/api-client` and shared contract types from OpenAPI, publish one error/auth boundary, and migrate hand-written duplicates without regressing current flows. This blocks every otherwise contract-complete row. |
| `FE-S02-03` | Establish the approved query/cache key, retry, invalidation, offline/stale, and mutation conventions. |
| `FE-S03-02` / `FE-S03-03` | Implement customer session bootstrap and Supabase phone-OTP UI/adapters/tests. Reuse the same approved auth foundation in merchant/captain apps. |
| `FE-S03-04` | Implement customer location permission/manual fallback and serviceability state without inventing persistence. |
| `FE-S03-01` / `FE-S03-06` | Freeze typed customer navigation and migrate the temporary root while preserving checkout/orders. |
| `FE-S06-01` / `FE-S06-02` | Preserve and integrate merchant session, notification permission/channel/device registration/ringtone/alert behavior. |
| `FE-S07-01` | Preserve and integrate captain session, location permission/freshness, and availability behavior. |
| `FE-S08-01` | Build the admin data/auth/MFA/permission-aware shell after admin contracts are reconciled. |

## Customer action ledger

| Screen/action | OpenAPI or external contract | Backend + auth/RLS | Types + existing tests | Readiness | Required gap ticket |
|---|---|---|---|---|---|
| C01 Splash — restore/refresh session and resolve role | Supabase Auth SDK; `getCurrentAccount` (`GET /me`) | `E-AUTH` | `T-OA`; hand-written customer session/current-account ports and restoration tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S03-02` |
| C02 OTP Login — request phone OTP | Supabase Auth SDK, outside OpenAPI | Supabase Auth is configured; no Vastra request-OTP controller is expected | Supabase SDK types; no customer request-OTP adapter/screen tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S03-03` |
| C02 OTP Login — verify/resend OTP and logout | Supabase Auth SDK, outside OpenAPI | Token verification is covered by `E-AUTH`; local-scope logout exists in session adapters | Supabase SDK/session-port types; restoration/logout tests only | `PLATFORM-GAP` | Backend: —; platform: `FE-S03-03` |
| C03 Profile Setup — read current profile/status | `getCurrentAccount` | `E-AUTH` | `T-OA`; current-account client/service tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S03-05` |
| C03 Profile Setup — create/update required profile fields | No operation | Profile tables/triggers exist, but there is no public update service/contract | `T-NONE`; schema/RLS tests do not cover an API action | `CONTRACT-GAP` | `BE-FE-001` |
| C04 Location Permission — request device permission/read coordinates | Device location SDK, outside OpenAPI | No backend action required | No shared location port for the customer app; captain has a separate provider | `PLATFORM-GAP` | Backend: —; platform: `FE-S03-04` |
| C04 Location Permission — test serviceability/manual coordinates | `getCustomerHome`, `listCustomerNearbyShops`, `searchCustomerProducts`, `getCustomerShopDetail` | `E-DISCOVERY`; customer role/readiness and service-radius RPC tests | `T-OA`; no generated client | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S03-04` |
| C05 Address List — list/select/default address | No operation | Address schema and self-access RLS exist; no controller/service | `T-NONE`; SQL `0004`, `0012` cover schema/RLS only | `CONTRACT-GAP` | `BE-FE-002` |
| C06 Add/Edit Address — create/update/delete/set default/validate | No operation | Address table/RLS and quote/order ownership checks exist; no CRUD API | `T-NONE`; no API tests | `CONTRACT-GAP` | `BE-FE-002` |
| C07 Home — load local feed/categories/shops/products | `getCustomerHome` | `E-DISCOVERY` | `T-OA`; customer-home service/integration and SQL discovery tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-01` |
| C08 Search — submit supported query | `searchCustomerProducts` | `E-DISCOVERY` | `T-OA`; search validation/service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-02` |
| C09 Search Results — paginate/open results | `searchCustomerProducts` | `E-DISCOVERY` | `T-OA`; cursor/search tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-02` |
| C10 Filters — category/gender/shop/price/availability/sort | `searchCustomerProducts` query parameters | `E-DISCOVERY` | `T-OA`; validation/integration/SQL filter tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-02` |
| C11 Categories — list Home categories and open category results | `getCustomerHome`; `searchCustomerProducts(categoryId=...)` | `E-DISCOVERY` | `T-OA`; Home/search tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-01/02` |
| C12 Nearby Shops — list by serviceable location | `listCustomerNearbyShops` | `E-DISCOVERY` | `T-OA`; nearby-shop service/integration and SQL `0023` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-03` |
| C13 Shop Details — read shop/serviceability/hours | `getCustomerShopDetail` | `E-DISCOVERY` | `T-OA`; shop-detail service/integration and SQL `0024` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-03` |
| C14 Product Listing — page shop catalogue | `listCustomerShopProducts` | `E-DISCOVERY` | `T-OA`; catalogue-read service/integration and SQL `0022` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-03` |
| C15 Product Details — read media/variants/live price/stock | `getCustomerCatalogueProduct` | `E-DISCOVERY` | `T-OA`; catalogue-read tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-04` |
| C16 Size Chart — read product/category measurements | No operation or size-chart schema | No size-chart table/read model/service found | `T-NONE`; no tests | `CONTRACT-GAP` | `BE-FE-003` |
| C17 Favourite Shops — list/add/remove | `listCustomerFavouriteShops`, `addCustomerFavouriteShop`, `removeCustomerFavouriteShop` | `E-DISCOVERY`; customer ownership/RLS | `T-OA`; preference service/integration and SQL `0026` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S04-05` |
| C18 Cart — get/add/replace quantity/update/remove/clear | `getCustomerCart`, `setCustomerCartItem`, `updateCustomerCartItem`, `removeCustomerCartItem`, `clearCustomerCart` | `E-CART`; customer ownership, one-shop and inventory checks | `T-OA`; cart service/integration and SQL `0027`; no generated client | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S05-01` |
| C19 Checkout — create/retry server quote | `createCustomerCheckoutQuote` | `E-CART`; owned address/serviceability/price/stock validation | `T-CUSTOMER`; quote client/screen tests plus backend/SQL `0028` | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S05-03` |
| C19 Checkout — apply/remove coupon | No operation; quote request accepts only `addressId` and currently quotes coupon discount as zero | No redemption service | `T-NONE`; no tests | `CONTRACT-GAP` | `BE-FE-026` |
| C20 Payment — place COD order | `placeCustomerCodOrder` | `E-CART`; transactional idempotency, stock reservation, history, outbox | `T-CUSTOMER`; placement client/screen tests plus backend/SQL `0029` | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S05-04` |
| C20 Payment — initialize/read/retry online payment | Existing backend-only `POST /orders/online`, `GET /orders/{orderId}/payments/latest`; generic webhook contract does not match `/webhooks/payments/cashfree` | `E-FINANCE`; customer role, idempotency, verified webhook/provider tests | Backend-local types only; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-005` |
| C21 Order Confirmation — read placed order identity/snapshot | `placeCustomerCodOrder`; `getCustomerOrder` | `E-CART`, `E-ORDER` | `T-CUSTOMER`; confirmation, placement, order-read tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S05-04/05` |
| C22 Orders — list/paginate | `listCustomerOrders` | `E-ORDER`; customer ownership/RLS | `T-CUSTOMER`; order-read client/screen/backend/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S05-05` |
| C23 Order Details — read snapshot/history/permitted status | `getCustomerOrder` | `E-ORDER` | `T-CUSTOMER`; detail/client/service/integration tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S05-05` |
| C24 Order Tracking — read task/location freshness | `getCustomerOrderTracking` | `E-DISPATCH`; customer-owned order/task projection | `T-OA`; delivery-secret and dispatch integration/SQL tests; no customer generated client | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S05-05` |
| C24 Order Tracking — read delivery OTP | `getCustomerDeliveryOtp` | `E-DISPATCH`; customer ownership and lifecycle restrictions | `T-OA`; delivery-secret/dispatch tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S05-05` |
| C25 Cancellation — check eligibility/cancel/recover race | Incomplete OpenAPI-only `POST /customer/orders/{orderId}/cancel` | No matching controller/service/migration/test | `T-NONE` | `CONTRACT-GAP` | `BE-FE-004` |
| C26 Return Request — read eligibility/create request | Backend-only `GET /orders/{orderId}/return-eligibility`, `POST /orders/{orderId}/returns` | `E-FINANCE`; customer ownership/idempotency/private return rules | Backend-local types and finance tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-006` |
| C27 Return Evidence — request upload/finalize/read signed evidence | Backend-only `POST /returns/{returnId}/evidence/upload-url`, `POST /returns/{returnId}/evidence`, `GET /returns/{returnId}/evidence/{evidenceId}/url` | `E-FINANCE`; private evidence ownership and signed access | Backend-local types and evidence/SQL tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-006` |
| C28 Return/Refund Tracking — read return/refund states | Backend-only `GET /returns/{returnId}`; refund status is available through backend-only admin/refund processing, not a customer refund contract | `E-FINANCE`; customer return ownership exists | Backend-local types/tests; no complete customer OpenAPI schema | `CONTRACT-GAP` | `BE-FE-006` |
| C29 Support Tickets — list/create/read own tickets | No customer operation | Support schema and RLS exist; admin case APIs exist, but no customer controller | `T-NONE`; schema/RLS/admin-case tests only | `CONTRACT-GAP` | `BE-FE-007` |
| C30 Ticket Conversation — list/send messages/upload attachment | No customer operation | Support messages/RLS exist; admin note API is not a customer conversation contract | `T-NONE`; no customer API tests | `CONTRACT-GAP` | `BE-FE-007` |
| C31 Ratings — check eligibility/submit/read own rating | No operation | Aggregate rating fields exist; no rating table/service/action found | `T-NONE`; no tests | `CONTRACT-GAP` | `BE-FE-008` |
| C32 Profile/Settings — read account/status | `getCurrentAccount` | `E-AUTH` | `T-OA`; `/me` and session tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S09-04` |
| C32 Profile/Settings — update profile/delete account | No operation | No backend lifecycle action | `T-NONE` | `CONTRACT-GAP` | `BE-FE-001` |
| C32 Profile/Settings — read/replace style/size/budget preferences | `getCustomerPreferences`, `replaceCustomerPreferences` | `E-DISCOVERY`; customer ownership/RLS | `T-OA`; preference service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S03-05/FE-S09-04` |
| C32 Profile/Settings — notification preferences | No operation | Device registration is not a preference contract | `T-NONE` | `CONTRACT-GAP` | `BE-FE-009` |
| C32 Profile/Settings — logout | Supabase Auth SDK | Session adapters call scoped sign-out | Supabase SDK/session-port types and restoration/logout tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S03-02`, `FE-S09-04` |
| C32 Profile/Settings — legal content | Static/versioned product content; no API required by current scope | No backend action required | No approved content delivery contract/test | `PLATFORM-GAP` | Backend: —; platform/content: `FE-S09-04` |
| C33 Style Hub — navigate to Wardrobe/looks/rooms | No server action | No backend action required | Typed route/navigation foundation not implemented | `PLATFORM-GAP` | Backend: —; platform: `FE-S03-01`, `FE-S14-01` |
| C34 Wardrobe List/Empty — list/filter owned items | `listWardrobeItems` | `E-WARDROBE`; owner-only/private RLS | `T-OA`; Wardrobe service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S14-02` |
| C35 Add/Edit Wardrobe Item — upload intent/create/update | `createWardrobeUploadIntent`, `createWardrobeItem`, `updateWardrobeItem` | `E-WARDROBE`; owner key prefix/private storage/validation | `T-OA`; upload/create/manage tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S14-03` |
| C36 Wardrobe Item Details/Delete — read/delete | `getWardrobeItem`, `deleteWardrobeItem` | `E-WARDROBE`; owner-only, transactional tombstone/storage cleanup | `T-OA`; management/deletion tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S14-02/03` |
| C37 Saved Looks — list | `listSavedLooks` | `E-WARDROBE`; owner-only | `T-OA`; saved-look tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S14-04` |
| C38 Create/Edit Look — create/read/update/delete/duplicate | `createSavedLook`, `getSavedLook`, `updateSavedLook`, `deleteSavedLook`, `duplicateSavedLook` | `E-WARDROBE`; owned items/products and tombstone rules | `T-OA`; saved-look, duplication, resolution tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S14-04` |
| C39 Look Details — resolve current product state/add eligible products to cart | `getSavedLook`, `addLookProductsToCart` | `E-WARDROBE`; owner-only, live price/stock, one-shop cart | `T-OA`; resolution/cart service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S14-05` |
| C39 Look Details — create/read/revoke private share outside a room | No operation | Owner-only look API cannot authorize a recipient | `T-NONE`; no share tests | `CONTRACT-GAP` | `BE-FE-010` |
| C40 Group Style Rooms — list rooms | `listGroupStyleRooms` is OpenAPI-only | No backend module/migration/RLS/tests | OpenAPI schema only; no shared client | `CONTRACT-GAP` | `BE-FE-011` |
| C41 Create Group Room/Invite — create room/invite | `createGroupStyleRoom`, `createGroupStyleInvite` are OpenAPI-only | No implementation/security/tests | OpenAPI schemas only | `CONTRACT-GAP` | `BE-FE-011` |
| C42 Join Group Room — join with invite/link/code | `joinGroupStyleRoom` is OpenAPI-only | No invite hashing/expiry/revocation implementation or tests | OpenAPI schema only | `CONTRACT-GAP` | `BE-FE-011` |
| C43 Group Room Activity — read room/activity | `getGroupStyleRoom` is OpenAPI-only | No durable room/activity projection/RLS | OpenAPI schema only | `CONTRACT-GAP` | `BE-FE-011` |
| C44 Group Share — share product/look | `createGroupStyleShare` is OpenAPI-only | No room-scoped snapshot/media authorization | OpenAPI schema only | `CONTRACT-GAP` | `BE-FE-011` |
| C44 Group Comments — add comment | `createGroupStyleComment` is OpenAPI-only | No durable/rate-limited implementation | OpenAPI schema only | `CONTRACT-GAP` | `BE-FE-011` |
| C44 Group Votes — set/update effective vote | `setGroupStyleVote` is OpenAPI-only | No uniqueness/concurrency implementation | OpenAPI schema only | `CONTRACT-GAP` | `BE-FE-011` |
| C44 Group Shortlist — add/remove | `addGroupStyleShortlistItem`, `removeGroupStyleShortlistItem` are OpenAPI-only | No unique shortlist implementation | OpenAPI schema only | `CONTRACT-GAP` | `BE-FE-011` |
| C44 Group Commerce — add product to individual cart | `addGroupStyleProductToCart` is OpenAPI-only | No membership/live-stock/one-shop transaction implementation | OpenAPI schema only | `CONTRACT-GAP` | `BE-FE-011` |
| C45 Group Members — remove member/close room/read closed room | `removeGroupStyleMember`, `closeGroupStyleRoom`, `getGroupStyleRoom` are OpenAPI-only | No owner/membership revocation or closed-room RLS | OpenAPI schemas only | `CONTRACT-GAP` | `BE-FE-011` |
| C46 Report Group Activity — submit private abuse report | `createGroupStyleAbuseReport` is OpenAPI-only | No private reporter/reviewer implementation | OpenAPI schema only | `CONTRACT-GAP` | `BE-FE-011` |

## Merchant action ledger

| Screen/action | OpenAPI or external contract | Backend + auth/RLS | Types + existing tests | Readiness | Required gap ticket |
|---|---|---|---|---|---|
| M01 Login — request/verify OTP/restore session/logout | Supabase Auth SDK; `getCurrentAccount` for role/status | `E-AUTH`; merchant readiness guard checks KYC/onboarding/approval | Merchant session is hand-written and has environment/session behavior; no OTP UI tests or generated `/me` types | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-01` |
| M02 Approval Status — read onboarding/KYC/approval state | `getCurrentAccount` | `E-AUTH` returns merchant profile status | `T-OA`; `/me` tests; no generated client | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-01` |
| M02 Approval Status — upload/submit/resubmit KYC | No operation | Merchant KYC tables/private storage exist; no self-service API | `T-NONE`; no API/storage flow tests | `CONTRACT-GAP` | `BE-FE-016` |
| M03 Dashboard — read operational summary | Incomplete OpenAPI-only `GET /merchant/dashboard` | No matching controller/service/test | `T-NONE` | `CONTRACT-GAP` | `BE-FE-012` |
| M04 Shop Status — read owned shop/status | `listMerchantCatalogueShops`, `getMerchantCatalogueShop` | `E-MCAT`; merchant-owned shop context | `T-OA`; shop-context service/integration tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-04` |
| M04 Shop Status — open/pause/status/profile/hours update | No operation | Admin pause controls exist, but no merchant self-service mutation | `T-NONE`; no tests | `CONTRACT-GAP` | `BE-FE-012` |
| M05 Notification Setup — register/update device token | `registerCurrentDevice` | `E-AUTH`; actor-owned device registration and tests | Hand-written merchant device client/runtime tests; no generated shared type | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-01` |
| M05 Notification Setup — request permission/configure urgent channel | Expo/Android notification APIs, outside OpenAPI | No backend action required | Merchant notification runtime/diagnostic types and tests exist | `PLATFORM-GAP` | Backend: —; platform: `FE-S06-01` |
| M06 Test Ringtone — play/stop local urgent sound and diagnostics | Device media/notification APIs, outside OpenAPI | No backend action required | Merchant alert runtime/payload/configuration tests exist | `PLATFORM-GAP` | Backend: —; platform: `FE-S06-01` |
| M07 Ringing New Order — receive push/read alert state | FCM payload plus `listMerchantOrders`/`getMerchantOrder` | `E-ALERT`; shop ownership, durable alert, scheduler/delivery tests | `T-MERCHANT`; local runtime/screen tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-02` |
| M07 Ringing New Order — acknowledge alert | `acknowledgeMerchantOrderAlert` | `E-ALERT`; owned alert/idempotent acknowledgement | `T-MERCHANT`; client/backend/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-02` |
| M08 Order Details — read owned order | `getMerchantOrder` | `E-ORDER`; shop ownership/RLS | `T-MERCHANT`; client/screen/service/integration tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-03` |
| M09 Accept and Prep Time — accept full order | `acceptMerchantOrder` | `E-ORDER`; state lock, full-order rule, idempotency/race tests | `T-MERCHANT`; decision client/screen/backend/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-03` |
| M10 Cannot Fulfil — reject with allowed reason/note | `rejectMerchantOrder` | `E-ORDER`; state lock, reservation release/cancel history | `T-MERCHANT`; decision validation/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-03` |
| M11 Packing Checklist — start packing/read checklist | `startMerchantOrderPacking`, `getMerchantOrderPackingList` | `E-ORDER`; state and shop ownership | `T-MERCHANT`; packing client/screen/service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-04` |
| M12 Verify Item — manual/barcode verification | `verifyMerchantOrderItem` | `E-ORDER`; order-item ownership and supported verification methods | `T-MERCHANT`; packing verification tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-04` |
| M13 Ready for Pickup — mark ready after all verification | `markMerchantOrderReadyForPickup` | `E-ORDER`; all-item verification/state transition/dispatch start | `T-MERCHANT`; ready client/screen/service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-04` |
| M14 Captain Arrived — read assigned delivery/arrival state | `getMerchantOrderDelivery` | `E-DISPATCH`; merchant shop/order projection | `T-OA`; dispatch/delivery-secret tests; no generated merchant client | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-04` |
| M15 Handover — display pickup code and observe pickup confirmation | `getMerchantPickupCode`, `getMerchantOrderDelivery`; captain `verifyCaptainPickupCode` is authoritative | `E-DISPATCH`; merchant can read code for owned order, captain verifies assignment/code | `T-OA`; pickup lifecycle/secret tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-04` |
| M16 Orders List — list/paginate shop orders | `listMerchantOrders` | `E-ORDER`; shop RLS | `T-MERCHANT`; list client/screen/backend tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S06-03` |
| M17 Products List — list owned-shop products | `listMerchantProducts` | `E-MCAT`; merchant shop ownership | `T-OA`; product service/integration tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-01` |
| M18 Add/Edit Product — create/read/update/archive | `createMerchantProduct`, `getMerchantProduct`, `updateMerchantProduct`, `archiveMerchantProduct` | `E-MCAT`; validation, ownership, moderation reset | `T-OA`; product service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-01` |
| M19 Product Images — list/upload intent/finalize/update/delete | `listMerchantProductImages`, `createMerchantProductImageUploadIntent`, `finalizeMerchantProductImage`, `updateMerchantProductImage`, `deleteMerchantProductImage` | `E-MCAT`; owned product/private upload intent/storage cleanup | `T-OA`; image service/integration/SQL `0014` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-01` |
| M20 Product Variants — list/create/read/update/deactivate | `listMerchantProductVariants`, `createMerchantProductVariant`, `getMerchantProductVariant`, `updateMerchantProductVariant`, `deactivateMerchantProductVariant` | `E-MCAT`; product ownership and variant validation | `T-OA`; variant service/integration/SQL `0015` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-01` |
| M21 Barcode Mapping — assign/update SKU/barcode on variant | Variant create/update contracts include SKU/barcode fields | `E-MCAT`; uniqueness and owned variant rules | `T-OA`; variant and barcode SQL/integration tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-01` |
| M22 Inventory List — page all variants/balances | No paginated list operation; lookup requires a search term and low-stock is a subset | Balance/search models exist but do not satisfy a complete inventory list | `T-NONE` for list contract | `CONTRACT-GAP` | `BE-FE-013` |
| M23 Variant Inventory — read balance | `getMerchantVariantInventoryBalance` | `E-MCAT`; owned shop/variant | `T-OA`; balance service/integration/SQL `0016` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-02` |
| M24 Barcode Scan — lookup barcode | `lookupMerchantInventoryByBarcode` | `E-MCAT`; owned-shop catalogue/inventory | `T-OA`; barcode service/integration/SQL `0018` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-02` |
| M25 Manual Search — lookup UUID/SKU/text | `lookupMerchantInventory` | `E-MCAT`; owned-shop inventory projection | `T-OA`; balance lookup tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-02` |
| M26 Inventory Action — adjust stock with reason/idempotency | `applyMerchantInventoryAdjustment` | `E-MCAT`; row lock, non-negative stock, immutable movement, ownership | `T-OA`; adjustment service/integration/SQL `0017` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-02` |
| M27 Movement History — list/filter movements | `listMerchantInventoryMovements` | `E-MCAT`; owned-shop immutable history | `T-OA`; movement integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-02` |
| M28 Low Stock — list low-stock variants | `listMerchantLowStockInventory` | `E-MCAT`; owned-shop read model | `T-OA`; low-stock service/integration/SQL `0021` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-02` |
| M29 Offline Sale — record retry-safe sale | `createMerchantOfflineSale` | `E-MCAT`; idempotency, row lock, inventory movement | `T-OA`; offline-sale service/integration/SQL `0019` tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-03` |
| M30 Returns — list/detail/receive/inspect | Existing backend-only `GET /merchant/returns`, `GET /merchant/returns/{returnId}`, `POST .../receive`, `POST .../inspection` | `E-FINANCE`; merchant shop ownership/idempotency/private evidence | Backend-local types and return tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-014` |
| M31 Sales Summary — read basic sales totals/history | No operation | No merchant self-service sales controller | `T-NONE` | `CONTRACT-GAP` | `BE-FE-015` |
| M32 Settlements — read eligibility/status/history | Existing settlement routes are admin-only | `E-FINANCE` does not expose a merchant-owned read contract | `T-NONE` for merchant | `CONTRACT-GAP` | `BE-FE-015` |
| M33 Followers Summary — read aggregate follower count | `getMerchantCatalogueShop` includes `followerCount` | `E-MCAT`; no customer identities exposed | `T-OA`; shop-context/preference tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S11-05` |
| M34 Support — list/create/read/message own cases | No merchant operation | Admin cases and support RLS exist; no merchant self-service controller | `T-NONE` | `CONTRACT-GAP` | `BE-FE-007` |

## Captain action ledger

| Screen/action | OpenAPI or external contract | Backend + auth/RLS | Types + existing tests | Readiness | Required gap ticket |
|---|---|---|---|---|---|
| D01 OTP Login — request/verify OTP/restore/logout | Supabase Auth SDK; `getCurrentAccount` | `E-AUTH`; captain readiness validates KYC/approval/suspension | Hand-written captain session/current-account types and restoration behavior; no OTP UI tests or generated `/me` type | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-01` |
| D02 KYC — upload documents/submit/update profile and vehicle | No operation | Captain profile/KYC tables/private-storage rules exist; no self-service API | `T-NONE`; no API/storage flow tests | `CONTRACT-GAP` | `BE-FE-017` |
| D03 Approval Status — read KYC/approval/suspension | `getCurrentAccount` | `E-AUTH` | `T-OA`; `/me` tests; no generated client | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-01` |
| D04 Home/Online Toggle — read/set availability | `setCaptainAvailability` | `E-DISPATCH`; captain role/readiness, active-task and location-freshness rules | `T-CAPTAIN`; presence client/screen/backend/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-01` |
| D04 Home/Online Toggle — submit current location | `updateCaptainCurrentLocation` | `E-DISPATCH`; sample idempotency/freshness/accuracy/rate constraints | `T-CAPTAIN`; location provider/client/screen/validation/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-01` |
| D05 Delivery Offer — list/accept/reject | `listCaptainDeliveryOffers`, `acceptCaptainDeliveryOffer`, `rejectCaptainDeliveryOffer` | `E-DISPATCH`; captain assignment lock and competing-offer cancellation | `T-CAPTAIN`; delivery client/screen/service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-02` |
| D06 Pickup Navigation — read active task/pickup coordinates and arrive | `getCaptainActiveDelivery`, `getCaptainDelivery`, `arriveCaptainAtPickup` | `E-DISPATCH`; assigned-captain ownership/proximity/state | `T-CAPTAIN`; lifecycle client/screen/backend tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-03` |
| D07 Pickup Details — read merchant/order pickup summary | `getCaptainDelivery` | `E-DISPATCH`; privacy-minimal assigned task | `T-CAPTAIN`; delivery client/screen tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-03` |
| D08 Pickup Code — verify/depart pickup | `verifyCaptainPickupCode`, `departCaptainPickup` | `E-DISPATCH`; code attempts/lockout/state/assignment | `T-CAPTAIN`; validation/service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-03` |
| D09 Merchant Delay — report supported problem | `reportCaptainDeliveryProblem` | `E-DISPATCH`; assigned task and supported reason validation | `T-CAPTAIN`; problem client/service/integration tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-05` |
| D10 Drop Navigation — read drop coordinates/depart pickup | `getCaptainDelivery`, `departCaptainPickup` | `E-DISPATCH`; assigned task and lifecycle state | `T-CAPTAIN`; delivery tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-04` |
| D11 Customer Arrival — mark arrival | `arriveCaptainAtCustomer` | `E-DISPATCH`; proximity/state/assignment | `T-CAPTAIN`; lifecycle validation/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-04` |
| D12 COD Collection — confirm expected amount and complete | `completeCaptainCodDelivery` | `E-DISPATCH`; assigned task, exact COD amount, OTP, idempotency | `T-CAPTAIN`; client/screen/service/integration/SQL tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-04` |
| D13 Delivery OTP — submit OTP/handle attempts and lockout | `completeCaptainCodDelivery`; customer reads OTP through `getCustomerDeliveryOtp` | `E-DISPATCH`; OTP is never returned to captain | `T-CAPTAIN`; completion/lockout tests | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S07-04` |
| D14 Failed Delivery — report problem/release before pickup | `reportCaptainDeliveryProblem`, `releaseCaptainDeliveryBeforePickup` | `E-DISPATCH`; safe release is explicitly pre-pickup | `T-CAPTAIN`; report/release tests | `PLATFORM-GAP` for pre-pickup action | Backend: —; platform: `FE-S02-02`, `FE-S07-05` |
| D14 Failed Delivery — terminate/escalate failure after pickup | No terminal failed-delivery operation | Problem reporting exists but does not contract the order/task terminal outcome after pickup | `T-NONE`; no state-machine/API tests | `CONTRACT-GAP` | `BE-FE-018` |
| D15 Earnings — read own earnings summary | No captain operation; finance routes are admin-only | `E-FINANCE` calculates/administers earnings but has no captain self read | `T-NONE` for captain | `CONTRACT-GAP` | `BE-FE-019` |
| D16 Delivery History — list/read completed deliveries | No captain list/history operation; `getCaptainDelivery` is task-specific | No self-history service | `T-NONE` | `CONTRACT-GAP` | `BE-FE-019` |
| D17 Payout Status — read own COD/payout eligibility/history | Admin-only `/admin/cod/*` and `/admin/payouts/*` backend routes | `E-FINANCE`; admin permissions only | `T-NONE` for captain | `CONTRACT-GAP` | `BE-FE-019` |
| D18 Support — list/create/read/message own case | No captain operation | Admin cases/support RLS exist; no captain self-service controller | `T-NONE` | `CONTRACT-GAP` | `BE-FE-007` |
| D19 Emergency — durable emergency/escalation action | No operation | Local phone/emergency UI cannot create an auditable operational record | `T-NONE` | `CONTRACT-GAP` | `BE-FE-007` |

## Admin action ledger

| Screen/action | OpenAPI or external contract | Backend + auth/RLS | Types + existing tests | Readiness | Required gap ticket |
|---|---|---|---|---|---|
| A01 Login + MFA — authenticate/enrol/challenge/logout | Supabase Auth/MFA SDK, outside OpenAPI; `getCurrentAccount` for role/status | `E-AUTH`; global AAL2 guard and admin permission tests | Supabase SDK types; no admin frontend auth client/screen; `/me` not generated | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S08-01` |
| A02 Dashboard — read operational counters | Incomplete `GET /admin/dashboard` | Matching `AdminDashboardController`/service/RPC in `E-ADMIN` | Backend-local types and dashboard tests; OpenAPI success is untyped | `CONTRACT-GAP` | `BE-FE-020` |
| A03 Live Orders — list/filter/paginate operational orders | Incomplete OpenAPI-only `GET /admin/orders` | No matching list controller/service | `T-NONE` | `CONTRACT-GAP` | `BE-FE-021` |
| A04 Order Details — read investigation/timeline/linked actors | Backend-only `GET /admin/orders/{orderId}/investigation` | `E-ADMIN`; `admin.orders.read`, MFA, safe projections | Backend-local types and investigation tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A05 Assignment/Reassignment — assign/release delivery task | Valid `assignAdminDeliveryTask`, `releaseAdminDeliveryTask` coexist with stale OpenAPI-only `POST /admin/orders/{orderId}/assign-captain` | `E-DISPATCH`; operations permissions, task locks/history; backend also has uncontracted release-operation/reset-verification | `T-OA` for task operations, backend-local types for extra controls; contract is ambiguous | `CONTRACT-GAP` | `BE-FE-020` |
| A05 Assignment/Reassignment — delivery OTP override | `overrideAdminDeliveryOtp` | `E-DISPATCH`; operations permission, reason/audit rules | `T-OA`; admin-delivery service/integration/SQL tests; no generated client | `PLATFORM-GAP` | Backend: —; platform: `FE-S02-02`, `FE-S08-04` |
| A06 Merchant List — list/filter/paginate merchants | No operation | Only merchant detail/controls exist | `T-NONE` | `CONTRACT-GAP` | `BE-FE-022` |
| A07 Merchant Details — read operational/KYC history | Backend-only `GET /admin/merchants/{merchantId}` | `E-ADMIN`; `admin.merchants.read`, MFA | Backend-local types/service tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A07 Merchant Details — pause/suspend/restore | Backend-only `POST .../pause-orders`, `.../suspend`, `.../restore` | `E-ADMIN`; manage permission, reason/audit/state checks | Backend-local types/service/SQL tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A08 Merchant KYC Review — approve/reject | Incomplete OpenAPI-only `POST /admin/merchants/{merchantId}/approve`; no reject contract | No matching approval service | `T-NONE` | `CONTRACT-GAP` | `BE-FE-023` |
| A09 Captain List — list/filter/paginate captains | No operation | Only captain detail/controls exist | `T-NONE` | `CONTRACT-GAP` | `BE-FE-022` |
| A10 Captain Details — read operational/KYC history | Backend-only `GET /admin/captains/{captainId}` | `E-ADMIN`; `admin.captains.read`, MFA | Backend-local types/service tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A10 Captain Details — suspend/restore/correct availability/release assignment | Backend-only captain control routes | `E-ADMIN`; manage permission, reason/audit/state checks | Backend-local types/service/SQL tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A11 Captain KYC Review — approve/reject | Incomplete OpenAPI-only `POST /admin/captains/{captainId}/approve`; no reject contract | No matching approval service | `T-NONE` | `CONTRACT-GAP` | `BE-FE-023` |
| A12 Customer Search — search supported customer identifier | Backend-only `GET /admin/search` returns supported result kinds | `E-ADMIN`; dashboard-read permission/MFA and safe search RPC | Backend-local types/search tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A13 Support Queue — list/filter/create operational case | Backend-only `GET/POST /admin/cases` | `E-ADMIN`; case read/manage permissions and RLS/RPC | Backend-local case types/service/SQL tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A14 Ticket Details — read/assign/note/escalate/resolve/close | Backend-only admin case detail/action routes | `E-ADMIN`; case permissions, transition history, audit | Backend-local types/service/SQL tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A15 Returns Queue — list/filter returns | Backend-only `GET /admin/returns`; stale OpenAPI-only approve route exists | `E-FINANCE`; `admin.returns.read`, MFA | Backend-local return types/tests; no valid OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-006` |
| A16 Return Details — read/assign pickup/decide | Backend-only `GET /admin/returns/{returnId}`, `POST .../assign-pickup`, `POST .../decision` | `E-FINANCE`; return permissions, reason/audit/idempotency | Backend-local types and finance tests | `CONTRACT-GAP` | `BE-FE-006` |
| A17 Refunds — list/read/create/retry/reconcile | Backend-only `/admin/refunds*` and `/admin/returns/{returnId}/refunds` | `E-FINANCE`; refund permissions, provider/idempotency/audit | Backend-local types/provider/service/SQL tests | `CONTRACT-GAP` | `BE-FE-006` |
| A18 Payments — list/read payment/provider events | No admin list/detail operation | Processing/retry backend exists, but no screen-complete read model | `T-NONE` for list/detail | `CONTRACT-GAP` | `BE-FE-024` |
| A18 Payments — process/retry payment events | Backend-only `POST /admin/payments/process-events`, `POST /admin/payments/events/{eventId}/retry` | `E-FINANCE`; payment-manage permission and provider tests | Backend-local types/tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020`, `BE-FE-024` |
| A19 Settlements — eligibility/create/read | Backend-only `GET /admin/settlements/eligibility`, `POST /admin/settlements`, `GET /admin/settlements/{settlementId}` | `E-FINANCE`; settlement permissions, integer money/idempotency | Backend-local types/service/SQL tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A20 COD Reconciliation — list/reconcile | Backend-only `GET /admin/cod/collections`, `POST /admin/cod/collections/{collectionId}/reconcile` | `E-FINANCE`; COD permissions, audit/idempotency | Backend-local types/service/SQL tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A20 Payout operations — eligibility/create/read | Backend-only `/admin/payouts*` | `E-FINANCE`; payout permissions, integer money/idempotency | Backend-local types/service/SQL tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A21 Catalogue Moderation — queue/read/approve/reject | No operation | Merchant product moderation state exists; no admin moderation controller | `T-NONE`; merchant tests only reject client-controlled moderation | `CONTRACT-GAP` | `BE-FE-025` |
| A22 Banners — list/create/update/activate/archive | No operation | No banner management service found | `T-NONE` | `CONTRACT-GAP` | `BE-FE-026` |
| A23 Coupons — list/create/update/activate/archive | No operation | No coupon management/redemption service found; quote discount is fixed at zero | `T-NONE` | `CONTRACT-GAP` | `BE-FE-026` |
| A24 Audit Logs — list/filter/read audit events | Backend-only `GET /admin/audit` | `E-ADMIN`; `admin.audit.read`, MFA, immutable audit source | Backend-local types/service/SQL tests; no OpenAPI/generated client | `CONTRACT-GAP` | `BE-FE-020` |
| A25 Admin Users/Roles — list/invite/change role/disable/review permissions | No operation | Four-role permission constants/guards exist; no admin-user lifecycle service | `T-NONE`; permission mapping/guard tests only | `CONTRACT-GAP` | `BE-FE-027` |

## OpenAPI operations with no direct frontend owner

The following contracts are backend/internal orchestration rather than screen actions:

- `createCustomerInventoryReservation` and `releaseCustomerInventoryReservation` should
  not be called to bypass checkout/order orchestration; order placement remains the
  authoritative reservation path.
- `registerCurrentDevice` is mapped to merchant notification setup above and may later
  be reused by customer/captain notification tickets.
- merchant-alert metrics/activity are mapped to the admin operations capability, but no
  dedicated frozen screen ID exists beyond Dashboard/Audit.
- webhook operations are provider callbacks, never client actions.

## Required implementation order after this gate

1. Complete `FE-S02-02` so a matching OpenAPI operation can produce generated/shared
   frontend types. Until then, preserve the tested hand-written customer/merchant/captain
   clients but do not duplicate more contracts.
2. Execute contract tickets in pilot-risk order: `BE-FE-002`, `BE-FE-004`,
   `BE-FE-020`, `BE-FE-021`, then the transaction-completion work in `BE-FE-005` and
   `BE-FE-006`.
3. Complete actor onboarding/self-service gaps (`BE-FE-012`–`BE-FE-019`) before their
   corresponding full application screens.
4. Complete trust/admin gaps (`BE-FE-001`, `BE-FE-003`, `BE-FE-007`–`BE-FE-010`,
   `BE-FE-022`–`BE-FE-027`).
5. Do not start Group Style UI until `BE-FE-011` passes contract, RLS, storage,
   authorization, concurrency, and generated-type checks.

## Audit conclusion

The COD backend slice is materially implemented and tested, but no new frontend action
is fully `READY` under the requested contract standard because shared client generation
is absent. Address CRUD is the immediate blocker inside the customer COD path. The most
severe contract drift is finance/admin: substantial tested backend behavior is invisible
to OpenAPI, while several legacy OpenAPI placeholders have no implementation. Group
Style remains contract-only and must not enter UI implementation.
