# Customer access and navigation E2E

Ticket: `FE-S03-07`

## Purpose

The frontend harness now includes a deterministic, interactive customer scenario for the
frozen access and root-navigation contract. It verifies navigation decisions without
contacting external authentication, location, notification, storage, or deep-link
providers.

## Covered behavior

- first launch, phone sign-in, OTP transition, and location explanation;
- denied location permission with a usable manual Tirupati fallback;
- exactly five tabs: Home, Discover, Style, Orders, and Profile;
- canonical selected-tab state and contextual Checkout back behavior;
- valid protected-link continuation after authentication;
- invalid-link recovery;
- wrong-role denial;
- resource-authorization denial without resource-detail leakage;
- session-expiry reauthentication with pending-destination continuation;
- main landmark, polite live status, labelled inputs, tablist semantics, keyboard focus,
  and reduced-motion behavior.

## Evidence boundary

The scenario is test-only HTML and in-memory state served by
`@vastra/frontend-test-harness`. It does not claim evidence for:

- live SMS delivery or a production OTP provider;
- Supabase session exchange or refresh;
- Android or iOS permission dialogs;
- real GPS/serviceability responses;
- operating-system universal/app links;
- native emulator or physical-device behavior.

Those checks remain owned by provider integration, device, and release-evidence tickets.
No production application route, API, database contract, OpenAPI operation, migration,
RLS policy, or product scope is changed by this ticket.
