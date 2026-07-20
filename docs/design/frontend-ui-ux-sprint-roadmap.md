# Vastra frontend UI/UX implementation roadmap

Status: implementation-ready planning baseline
Last reviewed: 2026-07-20
Operator guide: `docs/design/frontend-implementation-guide.md`

## Purpose

This roadmap delivers the frozen Vastra MVP in transaction-risk order. It does not
authorize new backend behavior or product scope.

The release-defining sequence is:

```text
Customer discovers and orders
→ inventory is reserved
→ merchant receives a loud alert and fulfils
→ captain picks up and delivers
→ customer confirms with OTP
→ admin can observe and recover failures
```

Wardrobe and private Group Style rooms remain MVP capabilities, but they follow a
proven COD operational slice. Vastra Couple, event-based Groups, a separate customer
website, AI sizing, body scanning, virtual try-on, and advanced recommendations are
post-MVP unless a later approved scope document explicitly enables them.

## Sources of truth

Read the smallest relevant set for each ticket. These files control the program:

1. `docs/architecture/security-model.md`
2. `docs/product/mvp-scope.md`
3. `docs/product/business-rules.md`
4. `docs/workflows/order-state-machine.md`
5. `docs/api/openapi.yaml`
6. `docs/testing/acceptance-tests.md`
7. `docs/design/design-system.md`
8. `docs/design/frontend-visual-contract.md`
9. `docs/design/frontend-screen-inventory.md`
10. `docs/design/navigation-map.md`

Security wins over every other source. Frozen scope wins over visual concepts.
Business rules win over UI assumptions, and OpenAPI is the API contract. Stop on an
unresolved conflict.

## Program rules

1. Implement exactly one ticket per branch and review its diff before the next.
2. Preserve tested customer checkout/orders, merchant ringing/fulfilment, and captain
   delivery behavior while replacing temporary shells.
3. Mark each ticket `READY`, `CONTRACT-GAP`, or `PLATFORM-GAP` before implementation.
4. A `CONTRACT-GAP` ticket may produce a contract proposal, but it may not fabricate a
   client-only success path.
5. Shared design tokens, root navigation, route types, and API/query infrastructure
   have one active owner at a time.
6. Use generated/shared API types. Do not duplicate contract models in screens.
7. Server state belongs in the approved query/cache layer; transient interaction state
   stays local.
8. Every data screen covers loading, empty where applicable, recoverable error,
   offline/stale behavior, authorization, session expiry, and accessibility.
9. Every mutation protects against duplicate submission and preserves server authority.
10. Customer, merchant, and captain use native React Native primitives. Admin uses
    accessible web primitives.
11. Do not claim device, E2E, visual-regression, or provider evidence unless it exists.
12. Ticket IDs are zero-padded: `FE-S02-01`, `FE-S03-01`, and so on. Sprint 1 revision
    tickets retain `FE-S1R-01` through `FE-S1R-05`.

## Presentation modes

| Mode | Use | Constraints |
|---|---|---|
| Brand | Splash, welcome, confirmation, delivered success | Emotional but brief; never blocks a task |
| Commerce | Search, product, checkout, orders, operations | Dense, legible, category-neutral |
| Hybrid | Customer Home, Wardrobe Home, selected collections | Commerce structure with at most two Brand moments |

Merchant, captain, and admin work surfaces are Commerce/operational only. The exact
visual and ornament policy is in `docs/design/frontend-visual-contract.md`.

---

# Gate 0 — scope, contract, and platform decisions

## Goal

Remove planning ambiguity before page composition begins.

## Tickets

- **FE-G0-01 — scope reconciliation:** freeze Couple, event-based Groups, and customer
  web as post-MVP; retain private room-based Group Style.
- **FE-G0-02 — API coverage ledger:** map every MVP screen action to OpenAPI and the
  current implementation; create backend tickets for missing contracts.
- **FE-G0-03 — navigation decision:** approve the customer five-tab model and typed
  route/deep-link contract.
- **FE-G0-04 — server-state decision:** choose the repository query/cache layer and
  error-normalization boundary.
- **FE-G0-05 — visual contract approval:** approve the Brand/Commerce/Hybrid contract,
  asset manifest, and light-theme MVP boundary.
- **FE-G0-06 — test-platform plan:** define unit/component, mobile E2E, admin E2E,
  accessibility, and visual-regression ownership.

## Exit criteria

- no MVP screen depends on Couple or event-based Group concepts;
- contract gaps have named backend tickets or are explicitly deferred;
- route, query/cache, and visual decisions are recorded;
- no production screen implementation has started.

---

# Sprint 1R — visual contracts and token foundation

## Goal

Encode the approved cosmic visual direction as accessible semantic contracts before
screens consume it.

## Tickets

- **FE-S1R-01 — semantic colour roles:** extend existing tokens with cosmic navy,
  royal blue, peacock teal, plum/magenta, warm gold, and tested foreground pairs.
- **FE-S1R-02 — presentation modes:** add typed `brand`, `commerce`, and `hybrid`
  definitions; light theme is required, dark theme remains compatible but is not an
  MVP release gate unless separately approved.
- **FE-S1R-03 — ornament policy:** document and type arch, flute, peacock, textile,
  sprinkle, editorial hero, and trust-strip usage.
- **FE-S1R-04 — asset contract:** add a manifest for full illustration, wordmark,
  compact mark, monochrome notification mark, app icon, and favicon; do not fabricate
  production artwork.
- **FE-S1R-05 — shell contracts:** define Brand, Commerce, and Hybrid shell behavior,
  safe areas, keyboard handling, reduced motion, and screenshot/a11y expectations.

## Exit criteria

- `@vastra/design-tokens` exports tested, framework-neutral values;
- every future screen can declare exactly one presentation mode;
- approved foreground/background pairs meet WCAG requirements;
- no feature screen was composed during this sprint.

---

# Sprint 02 — frontend platform

## Goal

Create the shared technical foundation without replacing working feature behavior.

## Tickets

- **FE-S02-01 — platform audit and preservation tests:** lock current checkout/orders,
  merchant alert/fulfilment, and captain delivery behavior with regression tests.
- **FE-S02-02 — typed API boundary:** generate or expose shared API types, auth headers,
  request IDs, error normalization, and structured client logging.
- **FE-S02-03 — query/cache foundation:** configure the approved server-state layer,
  retry policy, invalidation conventions, offline/stale semantics, and test helpers.
- **FE-S02-04 — shared primitives:** implement accessible buttons, fields, icons,
  status badges, prices, cards, skeletons, errors, sheets, dialogs, and toasts.
- **FE-S02-05 — application shells:** establish mobile safe-area/keyboard shells and the
  accessible admin layout foundation.
- **FE-S02-06 — frontend test harness:** add deterministic component fixtures and the
  agreed mobile/admin E2E and visual-regression entry points.

## Exit criteria

- presentational components make no direct network requests;
- temporary roots can be replaced without losing working flows;
- shared infrastructure has a single owner and passing tests.

---

# Sprint 03 — customer access, location, and navigation

## Goal

Take a new or returning customer to a stable five-tab shell with truthful location
and authentication recovery.

## Screens

Splash, welcome, phone login, OTP, profile setup, location explanation, manual
location, permission/serviceability failures, session expiry, and the root tab shell.

## Tickets

- **FE-S03-01 — typed route contract:** auth stack; tabs `Home`, `Discover`, `Style`,
  `Orders`, `Profile`; nested shop/product, checkout, return, support, Wardrobe, and
  Group Style routes.
- **FE-S03-02 — session bootstrap:** first launch, returning session, logout, expiry,
  and deterministic splash behavior.
- **FE-S03-03 — phone and OTP:** validation, resend timing, wrong/expired code,
  rate-limit messaging, and recovery.
- **FE-S03-04 — location:** explain permission, denied/blocked/GPS-off states, manual
  fallback, and server-confirmed serviceability.
- **FE-S03-05 — profile and optional preferences:** collect only supported required
  data; keep category, size, and budget preferences optional/editable.
- **FE-S03-06 — root migration:** replace the temporary Checkout/Orders switch while
  keeping both existing flows reachable.
- **FE-S03-07 — access/navigation E2E:** launch, login, location fallback, tab state,
  deep-link authorization, session expiry, accessibility, and back behavior.

## Contract gate

Authentication and location may proceed from existing contracts. Address CRUD must
not be inferred from database access; it remains blocked until an HTTP contract is
approved.

---

# Sprint 04 — discovery, shops, and products

## Goal

Prove that Vastra is “all kinds of fashion from local shops” and provide a reliable
path from Home to an available variant.

## Tickets

- **FE-S04-01 — Home composition:** location, search, one editorial hero, broad
  categories, nearby shops, trends, occasions, price bands, and trust strip.
- **FE-S04-02 — search contract:** suggestions, results, pagination, filters, sorting,
  no-results recovery, and preserved query state.
- **FE-S04-03 — shop experience:** nearby directory, shop details, open/closed state,
  delivery estimate, and catalogue.
- **FE-S04-04 — product detail:** media, real variants, size chart, price/stock refresh,
  shop/return information, and valid add-to-cart state.
- **FE-S04-05 — favourites and discovery states:** favourite shops, partial failures,
  stale/offline behavior, empty inventory, and service-area failures.
- **FE-S04-06 — discovery E2E:** Home → shop → product and search → product, including
  accessibility, pagination, and low-end image/scroll performance.

## Contract gate

Use current discovery/catalogue APIs. Reviews, customer photos, personalization, and
recommendation claims remain omitted unless a supporting contract exists.

---

# Sprint 05 — customer COD order slice

## Goal

Complete the customer side of the pilot transaction using the existing one-shop cart,
server quote, COD placement, orders, tracking, and OTP behavior.

## Tickets

- **FE-S05-01 — cart preservation and redesign:** retain tested cart/session behavior,
  one-shop enforcement, quantity/removal, stock refresh, and safe errors.
- **FE-S05-02 — address contract:** implement list/add/edit/select only after the Gate 0
  address API contract is approved.
- **FE-S05-03 — quote and fees:** render server-authoritative totals, fees, discounts,
  serviceability, and stock/price changes.
- **FE-S05-04 — COD placement:** confirmation, idempotency, duplicate-submit protection,
  unknown/retry state, and server-returned order navigation.
- **FE-S05-05 — orders and tracking:** preserve current session/order behavior; add the
  centralized status-to-copy/action map, list/detail/timeline, and delivery OTP state.
- **FE-S05-06 — COD customer E2E:** product → cart → address → quote → COD → confirmation
  → tracking, with failure injection and accessibility.

## Exit criteria

The customer COD journey works without client-authored totals, fake address data, or
duplicate placement. Cancellation is not enabled until its contract exists.

---

# Sprint 06 — merchant fulfilment slice

## Goal

Preserve the tested loud-alert infrastructure and take a COD order from merchant alert
through handover.

## Tickets

- **FE-S06-01 — merchant shell and readiness:** navigation, login/readiness states,
  notification permission/channel, device registration, ringtone test, and diagnostics.
- **FE-S06-02 — urgent alert:** preserve FCM channel/sound/acknowledgement/countdown;
  add accessible accept/reject and already-handled/expired states.
- **FE-S06-03 — order queue and decision:** actionable inbox, details, preparation time,
  rejection reason, authorization, and race recovery.
- **FE-S06-04 — packing and ready:** item verification, packing checklist, ready for
  pickup, captain state, and handover confirmation.
- **FE-S06-05 — merchant fulfilment E2E:** background/foreground alert, multi-device
  race, accept/reject, pack, ready, and handover on the approved device matrix.

## Exit criteria

The existing notification safety behavior is not regressed, and invalid order
transitions are never bypassed by the UI.

---

# Sprint 07 — captain COD delivery slice

## Goal

Take the merchant-ready order through captain assignment, pickup verification, customer
OTP, COD confirmation, and completion.

## Tickets

- **FE-S07-01 — captain shell/readiness:** root navigation, availability, permissions,
  GPS/service area, location freshness, weak-network, and session states.
- **FE-S07-02 — offer lifecycle:** preserve tested offers; add countdown, expired/taken
  races, assignment confirmation, and privacy-safe summaries.
- **FE-S07-03 — pickup:** merchant navigation/arrival, pickup code, failure/lockout, and
  authoritative pickup confirmation.
- **FE-S07-04 — drop and COD:** customer navigation/contact, delivery OTP, authoritative
  COD amount, collection confirmation, completion, and retry/unknown states.
- **FE-S07-05 — delivery failures:** supported failure reasons, safe escalation, and no
  distracting interaction while driving.
- **FE-S07-06 — captain COD E2E:** online → offer → pickup code → delivery OTP → COD →
  complete on the approved device matrix.

## Contract gate

Current completion is COD-specific. Prepaid delivery completion is blocked until the
backend state machine and OpenAPI contract support it.

---

# Sprint 08 — admin observation and recovery

## Goal

Replace the placeholder with the minimum permission-aware control plane needed to
observe and recover the COD pilot.

## Tickets

- **FE-S08-01 — admin shell and guards:** routing, session/MFA states when supported,
  permission-aware navigation, keyboard behavior, and responsive layout.
- **FE-S08-02 — live operations dashboard:** truthful counters and queues for waiting,
  stuck, unassigned, alert, payment/refund, and case states that have real queries.
- **FE-S08-03 — search and order detail:** supported identifier search, full timeline,
  linked actors, and operational state.
- **FE-S08-04 — assignment/recovery:** authorized confirmation, mandatory reason,
  idempotent progress, refreshed state, and visible audit outcome.
- **FE-S08-05 — core actor views:** merchant and captain detail sufficient for pilot
  recovery without exposing unnecessary personal data.
- **FE-S08-06 — admin recovery E2E:** dashboard → search → order → authorized recovery
  → reason → audit record, including permission denial and keyboard use.

## Exit criteria

The complete COD slice is visible end to end and privileged recovery remains enforced
on the server.

---

# Sprint 09 — customer trust, account, and support

## Goal

Complete the post-order and account capabilities required by frozen scope.

## Tickets

- **FE-S09-01 — cancellation** after eligibility/action contracts exist.
- **FE-S09-02 — support tickets and conversation** after customer support contracts
  exist.
- **FE-S09-03 — ratings** after eligibility and submission contracts exist.
- **FE-S09-04 — profile, addresses, preferences, notification settings, legal, logout,
  and account deletion** using approved contracts only.
- **FE-S09-05 — trust/account E2E** including authorization, session expiry, duplicate
  actions, destructive confirmation, and accessible recovery.

## Contract gate

Cancellation, customer support, ratings, address HTTP CRUD, and account deletion are
`CONTRACT-GAP` at this roadmap revision.

---

# Sprint 10 — online payment, returns, refunds, and finance

## Goal

Add the second payment path and the complete return/refund lifecycle after contracts
match the implementation and prepaid delivery is supported.

## Tickets

- **FE-S10-01 — payment contract reconciliation:** document create/verify/webhook and
  unknown/reconciliation states in OpenAPI and shared types.
- **FE-S10-02 — online payment UI:** processing, success, decline, cancellation,
  timeout, retry, and server-verified completion.
- **FE-S10-03 — prepaid delivery completion:** implement only after the state-machine
  gap is closed and tested across customer/captain/admin.
- **FE-S10-04 — customer return request:** eligibility, quantities, reasons, evidence,
  upload validation, and duplicate protection.
- **FE-S10-05 — merchant inspection and admin review:** expose supported receipt,
  inspection, decision, exception, and audit states.
- **FE-S10-06 — refund and finance views:** customer status, admin refund/provider
  failures, settlements, payouts, and COD reconciliation from authoritative data.
- **FE-S10-07 — payment/return E2E:** provider sandbox and lifecycle evidence, including
  failure and unknown states.

---

# Sprint 11 — merchant catalogue, inventory, and shop operations

## Tickets

- **FE-S11-01 — product/variant/image CRUD** with SKU/barcode and validation.
- **FE-S11-02 — inventory:** search/scan, variant stock, adjustment reasons, movements,
  low stock, and immutable history.
- **FE-S11-03 — offline sale:** retry-safe recording with success/unknown/failure state.
- **FE-S11-04 — shop controls:** status, profile, hours, and readiness where supported.
- **FE-S11-05 — sales, settlement, followers, and support** after self-service contracts
  are available.
- **FE-S11-06 — merchant operations E2E** with authorization and duplicate mutation
  coverage.

---

# Sprint 12 — captain onboarding, earnings, history, and support

## Tickets

- **FE-S12-01 — OTP, KYC, approval, suspension, profile, and vehicle states.**
- **FE-S12-02 — earnings and completed-delivery history** after captain self-service
  contracts exist.
- **FE-S12-03 — COD reconciliation and payout status/history** after self-service
  contracts exist.
- **FE-S12-04 — support and emergency escalation** using approved safety contracts.
- **FE-S12-05 — captain account/finance E2E** with privacy and permission coverage.

---

# Sprint 13 — admin MVP completion

## Tickets

- **FE-S13-01 — merchant and captain approval/KYC.**
- **FE-S13-02 — customer search and support queue.**
- **FE-S13-03 — returns, refunds, payments, settlements, payouts, and COD.**
- **FE-S13-04 — catalogue moderation.**
- **FE-S13-05 — banners and basic coupons.**
- **FE-S13-06 — audit logs and four-role admin-user management.**
- **FE-S13-07 — admin completion E2E:** permissions, confirmation/reason, audit, table
  accessibility, and responsive/keyboard behavior.

Each ticket is gated by OpenAPI coverage for its actions. Existing controllers that
are not contracted do not count as frontend-ready.

---

# Sprint 14 — Digital Wardrobe and saved looks

## Goal

Deliver private wardrobe management and saved looks without automatic image analysis.

## Tickets

- **FE-S14-01 — Style/Wardrobe navigation and private-default contract.**
- **FE-S14-02 — wardrobe list, empty state, categories, and item detail.**
- **FE-S14-03 — add/edit/delete uploaded or purchased items** with supported metadata
  and private media handling.
- **FE-S14-04 — saved looks:** create, rename, duplicate, edit, delete, and detail.
- **FE-S14-05 — look commerce:** refresh product availability, distinguish owned/shop
  items, and add eligible products to the one-shop cart.
- **FE-S14-06 — wardrobe/look sharing boundary:** private links or approved room-scoped
  sharing only; never expose the full wardrobe.
- **FE-S14-07 — Wardrobe E2E:** private default, media failure, authorization, revoke,
  look management, and add-to-cart.

---

# Sprint 15 — private Group Style rooms

## Goal

Deliver the frozen invitation-only room product: product/look sharing, comments,
`LOVE`/`MAYBE`/`SKIP` voting, shortlist, membership, reporting, and individual checkout.

## Tickets

- **FE-S15-01 — backend/OpenAPI room contract:** implement and contract durable room,
  invite, membership, share, comment, vote, shortlist, report, and close behavior.
- **FE-S15-02 — room entry:** create, link/join-code invitation, authentication return,
  join, invalid/expired invite, and membership state.
- **FE-S15-03 — room activity:** share approved products/looks, comments, votes, and
  real-time or refresh behavior without fabricated presence.
- **FE-S15-04 — shortlist and commerce:** refreshed product availability and individual
  add-to-cart/checkout under the one-shop rule.
- **FE-S15-05 — membership, moderation, and closure:** owner controls, leave/remove,
  abuse report, closed read-only state, and access revocation.
- **FE-S15-06 — Group Style E2E:** create → invite → join → share → comment/vote →
  shortlist → individual cart → close/report, with privacy/authorization coverage.

## Contract gate

This sprint is blocked until its OpenAPI-only contract has a backend module, migrations,
RLS, storage rules where needed, tests, and shared generated types.

---

# Sprint 16 — cross-platform closure and pilot proof

## Tickets

- **FE-S16-01 — screen/contract reconciliation:** mark every inventory item implemented,
  blocked, deferred, or intentionally removed.
- **FE-S16-02 — visual regression:** deterministic Brand, Commerce, and Hybrid baselines.
- **FE-S16-03 — accessibility audit:** contrast, target sizes, labels/roles, focus,
  dynamic text/zoom, forms, reduced motion, and non-colour status.
- **FE-S16-04 — low-end Android and responsive performance audit.**
- **FE-S16-05 — offline/error/recovery and duplicate-mutation audit.**
- **FE-S16-06 — privacy, permission, and client-secret audit.**
- **FE-S16-07 — physical COD pilot evidence:** customer → merchant → captain → admin.
- **FE-S16-08 — release builds, defect reconciliation, and evidence manifest.**

## Release exit

- all applicable repository checks pass;
- the physical COD journey has captured evidence;
- no unresolved critical/high defects remain;
- blocked/deferred screens are explicit;
- the pilot recommendation does not overstate unexecuted checks.

---

# Dependency and parallelization map

```text
Gate 0 → S1R → S02 → S03 → S04 → S05 → S06 → S07 → S08
                                   │
                                   ├→ S09 → S10
                                   ├→ S11
                                   ├→ S12
                                   └→ S13

S03 + backend-ready Wardrobe contracts → S14
S14 + Group Style backend contract      → S15
S08 + S09–S15 applicable scope          → S16
```

After S03 freezes shared contracts, independent application tickets may run in
parallel. Do not parallelize changes to shared tokens, root routes, shared API types,
the order state machine, or the same feature module.

# Current capability gates

| Area | Current disposition |
|---|---|
| Customer discovery/catalogue/cart/quote/COD/orders | `READY` with preservation tests |
| Merchant urgent alert and core fulfilment | `READY` with preservation tests |
| Captain offer/pickup/delivery/COD | `READY` for COD only |
| Admin core observation/recovery | `PARTIAL`; contract each action |
| Wardrobe and saved looks | `READY`/`PARTIAL`; audit existing behavior first |
| Address HTTP CRUD, cancellation, support, ratings, account deletion | `CONTRACT-GAP` |
| Online payment/returns/refunds | implementation exists in areas; OpenAPI/state-machine reconciliation required |
| Merchant catalogue/inventory/offline sale | `READY`; self-service shop/finance/support is partial |
| Captain KYC/earnings/payout/support self-service | `CONTRACT-GAP`/`PARTIAL` |
| Private Group Style rooms | `CONTRACT-GAP`; OpenAPI only, no complete backend slice |
| Couple, event-based Groups, customer website | `POST-MVP` |

# Per-ticket completion report

Every implementation ticket ends with:

```text
Summary
Files changed
Behavior implemented
Routes/screens changed
API contracts consumed
Tests added
Commands run and results
Accessibility/performance evidence
Documentation updated
Known limitations or follow-up
```
