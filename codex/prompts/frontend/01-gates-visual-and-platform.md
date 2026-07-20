# Codex prompt pack — gates, visual contracts, and frontend platform

Use `00-master-frontend-contract.md`. Execute exactly one named ticket from Gate 0,
Sprint 1R, or Sprint 02.

## Gate 0 — decisions before screens

Gate tickets are read-only analysis or documentation/contract decisions unless their
acceptance explicitly authorizes code.

### Required outcomes

- `FE-G0-01`: reconcile every proposed feature with frozen MVP; Couple, event-based
  Groups, and customer web remain post-MVP.
- `FE-G0-02`: map every screen action to OpenAPI, implementation, authorization, and
  tests; create a named dependency for each gap.
- `FE-G0-03`: freeze typed five-tab customer navigation and deep-link ownership.
- `FE-G0-04`: select the query/cache layer, keys, retries, invalidation, offline/stale,
  and error-normalization conventions.
- `FE-G0-05`: approve `docs/design/frontend-visual-contract.md`, asset manifest needs,
  and the light-theme MVP boundary.
- `FE-G0-06`: assign component/unit, mobile E2E, admin E2E, accessibility, visual
  regression, and physical-device evidence ownership.

Do not hide a gap by calling a database table directly from a client or by adding a
fake local mutation.

## Sprint 1R — visual contract implementation

Work areas:

- `packages/design-tokens`;
- existing shared UI packages only when the selected ticket owns them;
- `docs/design/design-system.md` and `docs/design/frontend-visual-contract.md`;
- the approved asset-manifest location.

### Ticket constraints

- `FE-S1R-01`: extend semantic roles without breaking current consumers; test canonical
  foreground/background contrast. Gold is not small body text.
- `FE-S1R-02`: add framework-neutral `brand`, `commerce`, and `hybrid` definitions; no
  arbitrary fourth mode. Light theme is required; do not expand into a full dark-theme
  screen program.
- `FE-S1R-03`: encode ornament density, accessibility, obstruction, and reduced-motion
  rules. Operational screens do not receive Brand decoration.
- `FE-S1R-04`: define the asset manifest and approvals; do not fabricate production
  logos/illustrations.
- `FE-S1R-05`: define/test Brand, Commerce, and Hybrid shells with safe area, keyboard,
  scrolling, focus, reduced motion, and state slots.

No feature page is composed in Sprint 1R.

## Sprint 02 — technical platform

### Preservation first

`FE-S02-01` audits and protects:

- customer checkout quote, COD placement, confirmation, orders, and session behavior;
- merchant urgent FCM channel/sound/registration/ack/countdown and fulfilment behavior;
- captain availability/location, offers, pickup code, delivery OTP, and COD completion.

Do not replace a working safety-critical implementation merely to make it visually
uniform.

### Platform boundaries

- `FE-S02-02`: generated/shared API types, auth headers, request IDs, normalized errors,
  and structured client logging.
- `FE-S02-03`: repository-approved server-state library, key factory, retries,
  invalidation, stale/offline semantics, and test utilities.
- `FE-S02-04`: accessible cross-application primitives with platform adapters.
- `FE-S02-05`: mobile and admin shells without feature ownership leakage.
- `FE-S02-06`: deterministic fixtures plus agreed component/E2E/visual entry points.

Do not add a production dependency without operator approval. Do not let feature
components perform direct network requests.

## Required evidence

- selected ticket's focused unit/type/contrast/component tests;
- preservation/regression tests when existing behavior is touched;
- applicable format, lint, typecheck, test, and build results;
- documentation of decisions and migration impact;
- no unrelated feature-screen diff.
