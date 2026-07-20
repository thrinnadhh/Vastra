---
project: Vastra
version: 1.0
status: Frozen MVP
ticket: FE-G0-04
last_updated: 2026-07-21
---

# Frontend server-state contract

## Decision and boundary

Vastra will use **TanStack Query v5** (`@tanstack/react-query`) as the one
repository-approved query, cache, and mutation coordinator for the customer, merchant,
captain, and admin frontends.

This is a documentation decision only. The dependency is not currently installed and
must not be added until the operator approves the production dependency in `FE-S02-03`.
Until `FE-S02-02` and `FE-S02-03` are complete, runtime readiness remains a
`PLATFORM-GAP` and the tested hand-written clients remain in place.

The decision does not change application behavior, OpenAPI, backend services,
migrations, RLS, product scope, or production dependencies. It does not make a
`CONTRACT-GAP` route implementable. The API coverage and backend-ticket authority
remains `docs/design/frontend-api-coverage-ledger.md`.

The selected separation is:

```text
screen / feature controller
        |
        v
@vastra/server-state query options + typed key factories
        |
        v
@vastra/api-client generated transport + normalized errors
        |
        v
OpenAPI operation -> backend authorization/RLS -> database/provider
```

`@vastra/api-client` stays framework-neutral and owns generated request/response types,
authentication headers, request IDs, response decoding, structured client logging, and
error normalization. `FE-S02-03` must create `@vastra/server-state` as the only owner of
TanStack Query configuration, typed key factories, query/mutation options, cache
policies, and mobile/web lifecycle adapters. Feature code may compose those exported
options, but may not invent a second query client, raw cache keys, or retry policy.

Supabase Auth session state, notification/audio runtimes, foreground location watchers,
navigation state, form state, modal state, countdown clocks, and other ephemeral UI
state do not belong in the query cache. Push and realtime messages are refetch signals,
not authoritative entity payloads.

### Selection rationale

TanStack Query provides one React API across Expo/React Native and Next, explicit
serializable keys, configurable stale/garbage-collection/refetch behavior, infinite
queries, invalidation, and mutations that default to no retry. Its official current
guidance covers [React Native focus and connectivity adapters](https://tanstack.com/query/latest/docs/framework/react/react-native),
[query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys),
[cache/retry defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults),
and [mutation behavior](https://tanstack.com/query/latest/docs/framework/react/guides/mutations).

SWR is not selected because this repository needs one equally explicit mobile/web
mutation and invalidation boundary. Redux/Zustand are general client-state stores and
would require a second bespoke server-cache protocol. Apollo/urql do not match the REST
OpenAPI contract. Continuing with screen-local effects would preserve the fragmentation
this gate exists to remove.

## Repository audit

Audit baseline: `40fbb9d` (`origin/main`) on 2026-07-21.

### Packages and dependencies

The customer, merchant, and captain manifests use Expo 57, React 19, React Native
0.86, Supabase, and AsyncStorage. The admin manifest uses Next 16 and React 19. None of
the four applications, the root workspace, or the shared frontend packages declares a
query/cache library, Axios, Redux, Zustand, Apollo, urql, SWR, or an equivalent
server-state owner.

`@vastra/api-client` is an empty, non-generated framework-neutral shell.
`@vastra/domain-types`, `@vastra/validation`, and `@vastra/testing` do not currently
provide a shared server-state or error boundary. No admin network/session client exists
yet.

### Existing runtime patterns

| Actor | Current pattern | Behavior that migration must preserve |
|---|---|---|
| Customer | Supabase session restoration and `/me` role verification are separate hand-written state machines. Checkout quote, COD placement, order list, and order detail call typed local `fetch` clients from effects and keep data/error/loading state in screens. Errors are feature-local unions. | Quote expiry is authoritative; stale order data remains visible after failed refresh; pagination deduplicates order IDs; COD placement disables duplicate submission and reuses the same in-memory idempotency key after a retryable failure. |
| Merchant | Supabase restoration and `/me` role verification are hand-written. Device registration, alert acknowledgement, order reads, decisions, packing, and ready actions use separate clients. Queue/detail screens own request counters and local state. | Queue polling remains 15 seconds while the queue is active. An active urgent alert verifies the order every 5 seconds. Ringtone replay and the one-second countdown remain device-runtime responsibilities. A failed authoritative read must not dismiss a still-active alert; acknowledgement clears it only after server success. |
| Captain | Supabase restoration and `/me` role verification are hand-written. Presence and delivery clients expose feature-local API errors; screens own reads, polling, command state, and foreground location watchers. | Delivery/offer refresh remains 10 seconds while the screen is active. Location watching remains outside the cache at the existing 10-second/25-metre sampling thresholds. Availability, assignment, pickup code, delivery OTP, COD, problem, and release outcomes remain server-authoritative. |
| Admin | Next shell only; no network/session client or server-state dependency exists. | Future reads require stable pagination and stale/live timestamps. Privileged actions require server permission, MFA where required, confirmation/reason, audit visibility, and an authoritative refresh. |

Existing customer client/screen/session tests, merchant alert/order/fulfilment tests, and
captain presence/delivery tests are preservation evidence, not permission to rewrite
behavior. `FE-S02-01` must close any missing regression coverage before migration.

## State ownership

| State | Owner | Rules |
|---|---|---|
| Supabase session, token refresh, account type/status, admin MFA state | Auth/session boundary | Never store access/refresh tokens in query keys or query data. A query client is created only after actor/account resolution. Clear it on sign-out, account change, role mismatch, disable/suspension, or admin authorization downgrade. |
| OpenAPI read results and server mutation lifecycle | `@vastra/server-state` | TanStack Query is the only repository cache/coordinator. Query functions call `@vastra/api-client`; screens do not call `fetch`. |
| Form input, selected controls, sheet/modal state, countdown presentation, pending route | Feature-local UI state | Preserve while a recoverable request runs. Never use it to assert server success. |
| Checkout/order/captain idempotency-key lifecycle | Mutation intent controller supplied by `@vastra/server-state` | Generate once per user intent, keep through an unknown/retry/reconciliation cycle, and clear only on terminal success, terminal rejection, explicit cancel, or authoritative replacement. Never put the key in query keys, analytics, or logs. |
| Merchant notification, ringtone, countdown, and Android channel | Merchant alert runtime | May invalidate/refetch merchant order keys. Query state must not silence the runtime on a transient error. |
| Captain foreground location stream | Captain location runtime | Sends new server-authoritative samples through the API client. Do not represent the stream as a query, persist coordinates, or replay stale samples after reconnect. |
| Navigation/deep-link ingress | Navigation/auth boundary | No route, invite token, OTP, pickup code, delivery OTP, or deep-link bearer value in query keys or persisted cache. |

Each application owns one query client per authenticated account. The admin must create
one client per browser session and one per server request when prefetching; it must never
use a process-global server cache. Customer, merchant, captain, and admin caches never
share memory. Cross-application changes arrive through the API, push/realtime signals,
focus/reconnect refresh, or the preserved polling loops.

## Typed query-key contract

`@vastra/server-state` owns all key factories. The public shape is a readonly,
JSON-serializable tuple beginning with actor and resolved account ID:

```ts
type Actor = 'customer' | 'merchant' | 'captain' | 'admin';
type AccountId = string & { readonly __brand: 'AccountId' };
type LocationScopeId = string & { readonly __brand: 'LocationScopeId' };
type AuthorizationEpoch = string & { readonly __brand: 'AuthorizationEpoch' };

type QueryRoot<A extends Actor> = readonly [A, AccountId];
```

The required factory families are:

```ts
customerKeys.root(accountId)
customerKeys.currentAccount(accountId)
customerKeys.home(accountId, locationScopeId)
customerKeys.search(accountId, locationScopeId, normalizedFilters)
customerKeys.nearbyShops(accountId, locationScopeId, normalizedFilters)
customerKeys.shop(accountId, locationScopeId, shopId)
customerKeys.shopProducts(accountId, locationScopeId, shopId, normalizedFilters)
customerKeys.product(accountId, locationScopeId, productId)
customerKeys.favouriteShops(accountId)
customerKeys.addresses(accountId)
customerKeys.address(accountId, addressId)
customerKeys.cart(accountId)
customerKeys.checkoutQuote(accountId, quoteId)
customerKeys.orders(accountId, normalizedFilters)
customerKeys.order(accountId, orderId)
customerKeys.returns(accountId, normalizedFilters)
customerKeys.returnDetail(accountId, returnId)
customerKeys.supportCases(accountId, normalizedFilters)
customerKeys.supportCase(accountId, caseId)
customerKeys.wardrobe(accountId, normalizedFilters)
customerKeys.wardrobeItem(accountId, itemId)
customerKeys.savedLooks(accountId, normalizedFilters)
customerKeys.savedLook(accountId, lookId)
customerKeys.groupStyleRooms(accountId, normalizedFilters)
customerKeys.groupStyleRoom(accountId, roomId)

merchantKeys.root(accountId, shopId)
merchantKeys.currentAccount(accountId, shopId)
merchantKeys.dashboard(accountId, shopId)
merchantKeys.orderQueue(accountId, shopId, normalizedFilters)
merchantKeys.order(accountId, shopId, orderId)
merchantKeys.packingList(accountId, shopId, orderId)
merchantKeys.alert(accountId, shopId, alertId)
merchantKeys.inventory(accountId, shopId, normalizedFilters)
merchantKeys.inventoryItem(accountId, shopId, variantId)
merchantKeys.returns(accountId, shopId, normalizedFilters)
merchantKeys.returnDetail(accountId, shopId, returnId)
merchantKeys.supportCases(accountId, shopId, normalizedFilters)

captainKeys.root(accountId)
captainKeys.currentAccount(accountId)
captainKeys.availability(accountId)
captainKeys.offers(accountId)
captainKeys.activeDelivery(accountId)
captainKeys.delivery(accountId, taskId)
captainKeys.history(accountId, normalizedFilters)
captainKeys.earnings(accountId, normalizedFilters)
captainKeys.supportCases(accountId, normalizedFilters)

adminKeys.root(accountId, authorizationEpoch)
adminKeys.dashboard(accountId, authorizationEpoch)
adminKeys.collection(accountId, authorizationEpoch, resource, normalizedFilters)
adminKeys.detail(accountId, authorizationEpoch, resource, resourceId)
adminKeys.audit(accountId, authorizationEpoch, normalizedFilters)
```

Rules:

1. Factories, not array literals, own all keys. Prefix factories support safe actor,
   resource, list, and detail invalidation.
2. Every input that changes an authoritative response belongs in the key. Filter
   objects are validated, normalized, and have deterministic defaults before key
   creation.
3. Exact latitude/longitude is represented by a process-local `LocationScopeId` that
   changes whenever the accepted location changes. Coordinates, phone numbers, search
   secrets, auth tokens, invite tokens, OTPs, idempotency keys, provider payloads, and
   free-form notes are never embedded in or logged from keys.
4. Cursor values are `pageParam` values for an infinite query, not separate root keys.
   The key contains the normalized filter/sort set. Pages preserve server order and
   deduplicate by stable entity ID.
5. The admin `AuthorizationEpoch` changes and its cache is cleared after MFA,
   permission, role, or account-status changes. It is an opaque process-local value,
   not a serialized permission list.
6. Mutation keys identify actor/resource/command only. Mutation variables remain
   outside the key and are never persisted.

Factories for a `CONTRACT-GAP` resource are reserved type ownership only. They are not
implemented as a query option and cannot trigger a request until the coverage ledger's
exact backend ticket and `FE-S02-02` are complete.

## Cache, stale, refresh, and pagination contract

TanStack defaults are overridden centrally. Feature screens may choose only one of the
approved policy classes or request a reviewed addition in `FE-S02-03`.

| Policy | Examples | `staleTime` | Inactive `gcTime` | Refetch |
|---|---|---:|---:|---|
| `CATALOGUE` | Home, search, nearby shops, shop, products | 60 seconds | 10 minutes | Active stale query on mount, screen/app focus, reconnect, location-scope change, or manual refresh |
| `PERSONAL` | favourites, customer order list, non-live profile/reference reads | 30 seconds | 10 minutes | Active stale query on mount/focus/reconnect and after related mutation |
| `TRANSACTION` | cart, order detail, packing list, captain task | 0 | 5 minutes | Refetch on mount/focus/reconnect and after commands; stale data may remain visible with a timestamp/banner |
| `LIVE` | merchant queue, urgent-alert order verification, captain offers/active delivery, admin live operations | 0 | 1 minute | Focused/active polling only, using the preserved intervals below; also refresh on signal/focus/reconnect |
| `EPHEMERAL_QUOTE` | checkout quote created by POST | 0 | Remove at `expiresAt`, never later than 5 minutes after inactivity | Created only by an explicit mutation; remove on cart/address/location change or expiry |

Preserved initial live intervals are exact migration inputs, not global defaults:

- merchant order queue: 15 seconds while its queue screen is focused;
- active merchant alert authoritative order check: 5 seconds while the alert exists;
- captain offers/active delivery: 10 seconds while its work screen is focused;
- merchant ringtone/countdown and captain location sampling remain outside TanStack
  Query.

Only one request for an exact query key may be active. Screen blur, app backgrounding,
route replacement, or actor-cache clear cancels unused requests when transport permits.
A manual refresh always requests authoritative data. A refresh failure keeps safe prior
read data visible, marks it stale, and exposes the last successful update time; it never
converts stale data into success for a command.

Pagination uses `useInfiniteQuery` semantics with the server cursor. Refresh replaces
the first page and reconciles later pages; load-more appends only the returned server
page, deduplicated by ID. A filter, sort, location scope, actor, or authorization change
creates a new key and must not merge pages. The client never calculates a replacement
cursor or reorders an authoritative operations queue.

No query or mutation cache is persisted to AsyncStorage, browser storage, disk, or a
service worker in the frozen MVP. This avoids retaining customer/order/location/admin
data and prevents paused unsafe mutations from resuming after restart. Auth persistence
remains owned by Supabase. A future persisted-read design requires a separate approved
privacy/security ticket and is not an FE-G0-04 gap.

## Mutation and invalidation contract

All remote mutations use `retry: 0`, `networkMode: 'always'`, and an online preflight.
`networkMode: 'always'` is deliberate: if connectivity detection is wrong, the request
must fail visibly rather than enter TanStack's paused mutation queue and resume later.
Mutation persistence and `resumePausedMutations` are forbidden for the MVP.

Commands on the same entity/intent run serially. Duplicate taps are disabled while an
intent is pending. A successful response may update the exact detail cache from the
validated server payload, then invalidates affected list/aggregate keys. Cache-update
failure does not turn a committed backend command into a failed command; the UI enters
authoritative reconciliation.

| Successful change | Required local cache effect |
|---|---|
| Profile, address, or accepted location change | Invalidate affected `/me`/profile/address reads; rotate location scope where applicable; invalidate discovery/serviceability and remove checkout quote. |
| Favourite shop add/remove | Update the favourite list only under the optimistic whitelist below, then invalidate favourite and affected shop projections. |
| Cart add/update/remove/clear | Apply only the validated server cart; invalidate cart projections and remove checkout quote. Never infer stock or price. |
| Create checkout quote | Store only the validated quote under its server quote ID; schedule removal at expiry. |
| Place order | Seed returned order detail, invalidate order lists, remove quote, and refetch/clear cart from authoritative response/operation contract. Unknown outcome enters reconciliation, not failure/re-submit. |
| Merchant alert acknowledgement/decision/packing/ready | Invalidate the merchant order detail, queue, alert, and packing keys affected by the response. Do not stop ringtone until the existing acknowledgement/authoritative-state rule is satisfied. |
| Captain availability/location | Update availability only from the server response; invalidate offers when dispatch eligibility changes. Location samples do not enter the query cache. |
| Captain offer/lifecycle/COD/problem/release | Invalidate offers, active delivery, task detail, and availability. Clear a task only from the validated authoritative response or a follow-up read. |
| Admin privileged command | Invalidate affected detail, collection, dashboard, and audit keys after server success; force an authoritative detail refresh before showing final operational state. |

Optimistic cache updates are denied by default. The only frozen-MVP candidate is
favourite-shop add/remove after its generated client and rollback tests exist. It must
cancel the exact query, snapshot prior data, apply a reversible projection, roll back
on error, and invalidate on settlement. Cart, checkout, order/payment/return/refund,
merchant alert/fulfilment, captain availability/location/delivery/COD, support, Group
Style membership/checkout, and all admin mutations are never optimistic.

Push, realtime, and notification payloads may target a typed key prefix and trigger a
refetch. They may not directly assert payment, inventory, order, alert, assignment,
delivery, permission, or audit state.

## Retry and unknown-outcome contract

The backend `ApiError.retryable` value is advisory. The client policy below is the
upper bound; a server flag may make an otherwise allowed retry stricter, never broader.

| Failure/operation | Automatic behavior | User/manual behavior |
|---|---|---|
| Normal GET read: transport, timeout, `502`, `503`, or `504` | At most 2 retries after the first attempt, full-jitter exponential delay from 500 ms capped at 4 seconds | Manual refresh remains available. |
| Focused `LIVE` poll attempt | No inner retry; the next scheduled poll is the retry so attempts cannot overlap | Manual refresh may run when no identical request is active. |
| `401` authentication | No Query retry. The auth boundary may refresh the Supabase session once and replay the operation once. A second `401` clears actor cache and returns to sign-in. | Do not expose a generic retry loop. |
| `403` authorization, `404` hidden/not found | Never retry | Render generic unavailable/access recovery without confirming a private resource. |
| `400`/`422` validation | Never retry | Preserve safe form state; correct fields and submit a new intent. |
| `409` conflict/stale state | Never retry | Invalidate/refetch authoritative state, explain the conflict, then require a new explicit intent. |
| `429` rate limit | A read may retry once only when a valid `Retry-After` is present and no more than 30 seconds. Mutations never auto-retry. | Show cooldown/retry timing when safely available. |
| Other `5xx` API failure | Normal reads follow the 2-retry cap; mutations never retry | Preserve stale safe reads and expose explicit retry/reconciliation. |
| Contract/malformed response or unknown error | Never retry | Report through structured diagnostics; show safe generic recovery. |
| Any mutation, including idempotent commands | Never auto-retry | A user retry is allowed only under the rules below. |

An idempotency key is generated at the start of a command intent and reused for every
manual retry of that same unresolved intent. Manual resend is also allowed when the
OpenAPI/backend contract makes the exact operation idempotent by method and semantics,
such as an authoritative PUT/upsert or a location sample deduplicated by `sampleId`.
A material command with neither guarantee is unsafe after a transport timeout: the
client must read authoritative state first and must not resend unless the read proves
the command did not commit and the operation contract makes a new intent valid.

Checkout quote creation is the explicit query-like POST exception. It has no purchase,
inventory, or payment success effect, so a manual retry may abandon the unknown quote
and request a new authoritative quote; it still receives no automatic retry and every
unused quote expires server-side.

For payment/provider, order placement, inventory, merchant decision, captain offer,
pickup, delivery OTP/COD, refund, payout, settlement, or other unknown outcomes, the
client never declares success or failure from the transport result alone. It polls or
refreshes the authoritative status/read operation. Provider success reported only by a
client is never trusted. `BE-FE-005` remains the exact contract dependency for online
payment initialization/status/reconciliation.

## Offline and stale contract by actor

| Actor | Reads while offline/stale | Writes while offline |
|---|---|---|
| Customer commerce | Show only safe in-memory catalogue, favourites, cart projection, or owned-order reads with an explicit stale/offline banner and last-updated time. Product availability, price, serviceability, quote, and order status are unconfirmed until refresh. | Do not call or queue cart, quote, order, payment, cancellation, return, support, or sharing mutations. Preserve non-secret form input locally in component memory and require an explicit retry after reconnect. |
| Merchant operations | A previously loaded queue/detail may remain visible as stale, but cannot be treated as the current actionable state. An urgent alert continues ringing/counting down until expiry or authoritative stop; a read failure never dismisses it. | Do not queue acknowledgement, accept/reject, packing verification, ready, inventory, or shop-status commands. Keep the alert visible and retry only on explicit merchant action with the required safety checks. |
| Captain delivery | An in-memory assigned-task snapshot may support labelled read-only contact/navigation context with a stale warning. Offer availability, assignment ownership, lifecycle state, COD amount, and OTP state require refresh. Discard old location samples and request a fresh one after reconnect. | Do not queue availability, offer, arrival, pickup-code, departure, drop, OTP/COD completion, problem, or release commands. Never show completion offline. |
| Admin | Show only authorized in-memory tables/details with a prominent stale timestamp. Permission/MFA changes immediately clear or hide the cache. | Disable privileged actions. Never queue an admin command; revalidate session, MFA, permission, resource state, and confirmation/reason after reconnect. |

“Offline” requires the platform connectivity signal or an explicit transport failure; a
single arbitrary exception is not proof. Mobile apps connect the repository
`ConnectivityPort` to TanStack `onlineManager` and AppState/navigation focus to
`focusManager`. The admin uses browser connectivity/focus behavior. The concrete mobile
connectivity package requires operator approval and is owned by `FE-S02-03`.

## Normalized error contract

`FE-S02-02` must export one framework-neutral discriminated error shape from
`@vastra/api-client`:

```ts
type ApiErrorKind =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'TRANSPORT'
  | 'TIMEOUT'
  | 'API'
  | 'CONTRACT'
  | 'UNKNOWN';

type NormalizedApiError = Readonly<{
  kind: ApiErrorKind;
  operationId: string;
  status: number | null;
  code: string | null;
  requestId: string | null;
  retryable: boolean;
  retryAfterMs: number | null;
  fieldErrors: Readonly<Record<string, readonly string[]>> | null;
  requiresAuthoritativeRefresh: boolean;
  userMessageKey: string;
}>;
```

| Kind | Source and required normalization |
|---|---|
| `AUTHENTICATION` | Missing/expired/invalid session or HTTP `401`; `retryable` is false and the session boundary owns the single refresh attempt. |
| `AUTHORIZATION` | HTTP `403`, role/readiness/MFA/permission denial; false, no resource-existence disclosure. |
| `VALIDATION` | HTTP `400`/`422` or local generated-input validation. Only allowlisted field issues enter `fieldErrors`; raw provider/backend details do not. |
| `NOT_FOUND` | HTTP `404` or visibility-safe missing resource; false. |
| `CONFLICT` | HTTP `409`, expired quote, stale version, invalid state, taken offer, or duplicate/state race; false and `requiresAuthoritativeRefresh` is true. |
| `RATE_LIMIT` | HTTP `429`; parse a valid bounded `Retry-After` when present. Retryability still follows the read/mutation matrix. |
| `TRANSPORT` | Fetch/network/DNS/TLS failure with no valid HTTP response; include no raw URL, headers, token, or request body. |
| `TIMEOUT` | Client deadline/abort specifically identified as timeout; mutation outcomes require reconciliation. |
| `API` | Valid `ApiError` or HTTP failure not covered above, including allowed `5xx`; preserve safe `code`, `requestId`, and computed retryability. |
| `CONTRACT` | Success/error envelope cannot be decoded by generated schemas; false and report as contract drift. |
| `UNKNOWN` | Anything unmapped; false by default. |

The OpenAPI `ApiError` envelope supplies `code`, `message`, optional `details`, optional
`retryable`, and optional `requestId`. The normalizer does not show the raw server
message directly. A central, tested `code -> userMessageKey/action` mapping provides
actor-appropriate copy. Unknown codes use safe generic copy. Supabase Auth errors enter
the same categories without copying secrets or provider payloads.

Structured diagnostics may record operation ID, error kind, safe code, HTTP status,
request ID, attempt count, duration, actor type, and app version. They must not record
tokens, cookies, idempotency keys, OTPs/codes, coordinates, phone numbers, addresses,
notes, provider payloads, raw response bodies, mutation variables, query keys, or cache
data. The original exception may be held as a non-serializable local cause for debugging
but is not part of `NormalizedApiError` or telemetry.

Existing `CustomerCheckoutQuoteError`, `CustomerOrderError`, `MerchantOrderError`,
`MerchantDeviceRegistrationError`, `MerchantOrderAlertAcknowledgementError`,
`CaptainPresenceApiError`, and `CaptainDeliveryApiError` are temporary adapters. They
must migrate behind this shape under `FE-S02-02`/`FE-S02-03` without changing current
screen copy or preservation tests in the same step.

## Exact follow-up tickets

| Ticket | Required outcome before this contract is runtime-ready |
|---|---|
| `FE-S02-01` | Add/confirm preservation tests for customer stale reads and same-intent COD idempotency; merchant 15-second queue polling, 5-second alert verification, ringtone/countdown/ack safety; captain 10-second delivery polling, location sampling, and all lifecycle/COD commands. |
| `FE-S02-02` | Generate `@vastra/api-client`, implement the exact normalized error/auth/request-ID/logging boundary above, and migrate hand-written decoders without behavior regression. |
| `FE-S02-03` | Obtain operator approval for and install TanStack Query v5; create `@vastra/server-state`; implement the typed factories, policy classes, retry functions, mutation intent/idempotency helpers, QueryClient lifecycle, `ConnectivityPort`, mobile/web focus adapters, and invalidation utilities defined here. No persisted cache or mutation queue. |
| `FE-S02-06` | Add deterministic shared tests for key equality/prefixes, cache partition/clear, retry matrix, stale/GC classes, pagination deduplication, invalidation, no unsafe retry/resume, offline actor policies, and normalized error rendering. |
| `FE-S03-02` | Integrate customer QueryClient creation/clear with session bootstrap, token refresh, role checks, sign-out, and account change. Reuse this contract for merchant/captain session migration. |
| `FE-S06-02`, `FE-S06-03`, `FE-S06-04` | Connect merchant push/alert, queue/decision, and packing/ready flows to typed invalidation while preserving ringtone, countdown, authoritative-stop, polling, and no-offline-command rules. |
| `FE-S07-01` through `FE-S07-05` | Connect captain presence/offers/pickup/drop/COD/failure flows; retain location outside the cache and keep a stable idempotency key for each unresolved command intent. |
| `FE-S08-01` | Create the per-session/per-request admin query boundary and clear it on auth, MFA, permission, role, or account-status change. Do not implement contract-gapped admin resources. |
| `BE-FE-005` | Supply the online-payment initialization/status/provider-reconciliation contract needed for truthful unknown-outcome handling. |

No new backend ticket is created solely for query/cache selection. All unresolved
screen operations remain blocked by the exact `BE-FE-001` through `BE-FE-027` tickets
mapped row-by-row in `docs/design/frontend-api-coverage-ledger.md`; this layer must not
replace any of them with direct database access or local success. In particular,
`BE-FE-020` through `BE-FE-027` remain the admin data/action dependencies.

## Readiness conclusion

The FE-G0-04 architecture decision is frozen. Runtime status is `PLATFORM-GAP` until
`FE-S02-01`, `FE-S02-02`, `FE-S02-03`, and `FE-S02-06` are complete and the relevant
actor integration ticket passes. A feature also remains `CONTRACT-GAP` wherever the
coverage ledger names a `BE-FE-*` dependency.

This contract deliberately fits TanStack Query's current React Native focus/online
adapters, serializable query-key model, configurable stale/garbage-collection behavior,
and default no-retry mutation behavior. Vastra overrides the library's default read
retries and prevents paused/offline mutation resumption because commerce and operations
require stricter outcome handling.
