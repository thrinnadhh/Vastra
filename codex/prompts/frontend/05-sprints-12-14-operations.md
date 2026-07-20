# Codex prompt pack — Sprints 12 to 14 operational applications

Use the master contract. Operational speed, state accuracy, permissions and recovery take priority over brand decoration. Execute one roadmap ticket at a time.

# Sprint 12 — merchant application

## Objective

Expose existing merchant fulfilment, inventory, offline-sale, return and shop-control capabilities through a fast Android-first operational interface.

## Visual mode

Commerce/operational only:

- warm neutral surfaces;
- plum primary decisions;
- cosmic/royal blue information and selected navigation;
- amber urgency;
- teal success;
- red destructive/failure;
- no cosmic sprinkles, ornate arches or decorative peacock/flute assets in active work screens.

## Readiness screens

Implement existing states for:

- login and OTP;
- approval pending;
- KYC pending/rejected;
- suspension;
- shop paused;
- notification permission/channel/device registration;
- ringtone test;
- battery-optimisation guidance.

Do not imply reliable ringing until permission, device registration and channel checks actually pass.

## Urgent order alert

- display order identity, countdown/expiry and clear accept/reject actions;
- use existing multi-device ownership/state rules;
- handle already accepted/rejected/expired on another device;
- require a rejection reason when the backend contract requires it;
- keep touch targets large and readable from a distance;
- use audio/haptics only through approved device capabilities and settings.

## Fulfilment

- order inbox grouped by actionable state;
- order detail and customer-safe summary;
- preparation-time selection;
- item verification and packing checklist;
- ready-for-pickup transition;
- captain assignment and handover confirmation;
- disabled actions explain invalid state.

## Inventory and offline sale

- list/search/filter variants;
- stock adjustment with reason;
- immutable movement history;
- low/out-of-stock states;
- retry-safe offline sale with clear success/unknown/failure state;
- do not calculate authoritative stock locally.

## Returns

- incoming return queue;
- receipt confirmation;
- line/item inspection;
- condition/evidence;
- merchant decision only when authorized;
- admin-review and refund states.

## Required tests

- readiness/permission states;
- alert countdown/expiry;
- multi-device already-handled race;
- accept/reject;
- packing/ready/handover transitions;
- stock adjustment validation;
- duplicate offline sale;
- return inspection permissions;
- full merchant E2E and physical-device evidence.

# Sprint 13 — captain application

## Objective

Create a low-distraction delivery interface with large actions, accurate location/assignment states and safe COD handling.

## Availability

- online/offline;
- GPS disabled/permission denied;
- outside service area;
- location freshness;
- weak network;
- finding offers.

Do not display online readiness when required location conditions are not satisfied.

## Offer

- pickup/drop summary consistent with privacy rules;
- distance/earning only when provided by backend;
- countdown and expiry;
- accept/reject;
- accepted by another captain;
- assignment confirmation before navigation.

## Active delivery

- one dominant next action;
- merchant navigation/arrival;
- pickup-code verification, wrong-code and lockout states;
- pickup confirmation;
- customer navigation/contact;
- delivery OTP and retry/lockout;
- COD amount from authoritative order data;
- explicit COD collection confirmation;
- completion and earning summary.

## Failure and safety

Implement existing failure reasons such as customer unavailable, address issue, merchant delay, vehicle issue, unsafe situation and COD problem. Support escalation through existing contracts. Never encourage unsafe interaction while driving.

## Earnings and reconciliation

- earnings summary;
- completed deliveries;
- COD pending/reconciliation;
- payout eligibility/history;
- profile, vehicle and support.

## Required tests

- location readiness;
- offer expiry/taken race;
- assignment state;
- pickup and delivery code states;
- COD amount/confirmation;
- failure escalation;
- earnings/reconciliation rendering;
- full captain E2E and physical-device evidence.

# Sprint 14 — admin dashboard

## Objective

Replace the placeholder admin shell with permission-aware operational monitoring, search, recovery, finance and support pages.

## Shell

- Next.js routing/layout consistent with the repository version;
- navy sidebar, ivory background, white surfaces, plum selected state;
- keyboard navigation and visible focus;
- permission-based navigation;
- responsive desktop and usable reduced-width behaviour;
- session expiry and MFA routes where supported.

## Dashboard

Use existing backend counters and operational search. Show:

- merchant-waiting orders;
- unassigned/stuck deliveries;
- payment/refund failures;
- alert failures;
- open cases;
- COD disputes;
- trends only when a real query exists.

## Search and details

- global search by supported identifiers;
- order detail with complete timeline and linked actors;
- merchant/captain details with operational history;
- return/refund/finance/case detail.

## Privileged actions

For recovery, suspension, approval, refund, reassignment or configuration actions:

- require authorization;
- present consequences;
- require confirmation;
- require an operational reason when the API supports/mandates it;
- show idempotent progress/result;
- refresh authoritative state;
- expose audit identity/outcome where available.

## Tables

- accessible headers and sorting;
- server pagination/filtering;
- empty/error/loading states;
- no colour-only status communication;
- detail drawer or page without trapping focus;
- compact density without violating target/focus requirements.

## Required tests

- route and permission guards;
- dashboard state;
- search;
- order recovery success/failure/race;
- merchant/captain controls;
- returns/refunds;
- finance/COD;
- cases/audit;
- keyboard and screen-reader checks;
- Playwright critical admin journey.

## Cross-operational constraints

- Do not expose customer private data beyond operational need.
- Do not expose secrets, provider credentials or service-role keys.
- Do not add decorative Brand mode to urgent operational screens.
- Do not duplicate backend authorization only as a client check; server enforcement remains mandatory.
- Do not allow one agent to change shared operational status enums while another consumes them.
