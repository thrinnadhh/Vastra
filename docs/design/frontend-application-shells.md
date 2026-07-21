# FE-S02-05 application shell contract

Status: implemented frontend platform foundation
Ticket: `FE-S02-05`

## Classification

`READY`. Existing customer, merchant, and captain roots already used safe-area providers, but each owned a different root wrapper and none provided a reusable keyboard, header/footer, scrolling, or overlay composition boundary. The admin application had a valid Next.js root but only rendered a centered foundation page without shared skip-link, navigation, or main-landmark ownership.

This ticket does not require an HTTP contract and does not own feature navigation, feature screens, authentication behavior, server state, or design-token values.

## Shared package

`@vastra/app-shells` owns three boundaries:

1. framework-neutral mobile/admin shell contracts;
2. `@vastra/app-shells/native`, the React Native safe-area and keyboard adapter;
3. `@vastra/app-shells/admin`, the semantic web landmark adapter.

The package has no network, storage, API, query, authentication, or navigation dependency. It does not import app-specific routes and remains free from Node-only runtime imports.

## Mobile shell behavior

`MobileApplicationShell` provides:

- explicit customer, merchant, or captain ownership;
- all-edge safe-area containment within the app's existing `SafeAreaProvider`;
- keyboard avoidance with iOS padding and Android height behavior;
- optional scrolling with handled keyboard taps and platform-appropriate dismissal;
- stable header, body, footer, and overlay ordering;
- a non-scrolling default so feature-owned lists and scroll views are not nested;
- app-owned background styling so existing customer, merchant, and captain visual behavior is preserved.

Merchant and captain contracts are restricted to Commerce mode. Customer Brand/Hybrid modes are available as contracts but are not activated by this ticket.

## Admin shell behavior

`AdminApplicationShell` provides:

- a keyboard-visible skip link to the root main content;
- one banner/topbar, one labelled navigation landmark, and one focusable main landmark;
- `aria-current="page"` for the current navigation item;
- optional utility and contextual-panel slots without manufacturing privileged controls;
- responsive desktop sidebar and compact horizontal mobile navigation;
- visible focus styling and reduced-motion handling.

The current admin navigation contains only the existing Overview route. No order, finance, approval, support, or configuration capability is implied by the shell.

## Migration and preservation

The customer Checkout/Orders switch, merchant order/alert tree, and captain operations tree remain unchanged beneath the shared native shell. Session providers and status bars remain in their existing application roots. The admin foundation page is now a section beneath the root shell's single main landmark.

Existing mobile background colours and the existing admin palette are retained at the application adapter layer. Resolved visual tokens remain owned by `FE-S1R-*`; this ticket does not claim that `@vastra/design-tokens` is complete.

## Package and dependency impact

The four frontend applications add only the internal `workspace:*` dependency on `@vastra/app-shells`. The shell package uses the React, React Native, and safe-area versions already present in the workspace; no new external runtime library or product capability is introduced.

## Verification ownership

Focused coverage includes:

- mobile safe-area, keyboard, scroll, and overlay contract defaults;
- Commerce-only merchant/captain enforcement;
- admin navigation uniqueness and current-item rules;
- skip-link and landmark SSR output;
- customer, merchant, and captain root-shell reachability while preserving feature children;
- admin root-layout integration and feature-neutral foundation content.

`FE-S02-06` still owns deterministic component fixtures, mobile/admin E2E entry points, and visual-regression infrastructure.
