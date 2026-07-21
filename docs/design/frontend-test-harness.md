# FE-S02-06 frontend test harness

Status: implemented frontend platform foundation
Ticket: `FE-S02-06`

## Classification

`READY`. The frozen architecture selects Vitest/Jest and Playwright. `FE-S02-04` and
`FE-S02-05` now expose deterministic primitive and shell contracts, so this ticket can
add test-only fixtures and browser entry points without changing feature behavior or an
HTTP contract.

## Ownership

`@vastra/frontend-test-harness` owns:

- deterministic, serializable fixtures for shared primitive states;
- customer, merchant, captain, and admin shell-contract fixtures;
- stable fixture IDs, routes, compact/large viewports, and assertion manifests;
- a local Node fixture server with no backend, Supabase, authentication, or provider
  dependency;
- test-only browser entry points consumed by Playwright.

The package does not own production renderers, feature screens, navigation, API mocks,
server-state behavior, or product success paths.

## Entry points

- `pnpm test:frontend:fixtures` runs deterministic registry and server tests.
- `pnpm test:frontend:e2e` runs Chromium keyboard/responsive admin checks and compact
  customer/merchant/captain shell-contract checks.
- `pnpm test:frontend:visual` captures deterministic Chromium screenshots and compares
  their SHA-256 hashes with `e2e/visual-baselines.json`.
- `pnpm test:frontend:harness` runs all three layers.

Playwright is pinned to a Node 20-compatible version. Only Chromium is installed in CI
for this foundation ticket; multi-browser/device expansion belongs to feature and release
coverage tickets.

## Determinism rules

- fixtures use stable IDs, fixed INR/test copy, fixed viewports, and no clock, random,
  network, authentication, or database values;
- the fixture server sends `no-store` responses and uses fixed CSS with reduced motion;
- visual hashes are valid only for the pinned Playwright Chromium build on the CI runner;
- changing a fixture intentionally requires reviewing and regenerating the affected hash;
- visual hash updates are evidence changes, not an automatic approval of a UI change.

## Evidence boundary

This ticket proves that component contracts and browser harness entry points are
executable. It does not claim native Android/iOS emulator passage, push-notification
behavior, real provider integration, or physical-device evidence. Those remain owned by
feature E2E tickets and the release evidence sprint.

## Preservation

Customer checkout/orders, merchant alert/fulfilment, captain presence/delivery, and admin
feature behavior are untouched. The harness imports only shared primitive and shell
contracts and cannot perform production network requests.
