# Codex prompt pack — Sprints 15 and 16 website and closure

Use the master contract. Execute one roadmap ticket at a time.

# Sprint 15 — customer website

## Objective

Create a responsive customer website that preserves Vastra's warm fashion-world identity without stretching mobile layouts or compromising ecommerce clarity and performance.

## Route scope

- Home;
- nearby shops;
- shop detail;
- category and collection;
- product detail;
- cart and checkout;
- orders and tracking;
- Wardrobe;
- Style Together;
- Couple and Groups landing/management where supported;
- profile and support.

## Design allocation

The website Home may use approximately 35% Brand storytelling and 65% Commerce structure. Transactional pages remain Commerce.

Use:

- wide editorial hero with optimized responsive sources;
- fashion avenues/collection zones;
- nearby store windows/directories;
- modern casual, western, office, kids and ethnic balance;
- subtle hover/focus transitions;
- warm ivory, navy, plum, teal and restrained gold.

Do not use:

- autoplay video that blocks interaction;
- heavy parallax on low-power devices;
- persistent decorative particles over content;
- mobile card widths simply stretched across desktop;
- hover-only actions;
- inaccessible custom controls.

## Responsive rules

Verify at minimum:

- compact mobile web;
- large mobile;
- tablet;
- 1280 desktop;
- 1440 desktop;
- wide desktop.

Use content-width tokens and responsive grids. Preserve readable line lengths and product-image aspect ratios.

## Reuse rules

- Reuse domain/query logic where platform boundaries allow.
- Build web-specific accessible components instead of forcing React Native components into Next.js.
- Keep route/server/client component boundaries consistent with the repository's Next.js version.
- Keep secrets and privileged calls server-side.

## SEO and metadata

Add supported metadata for public shop, category, collection and product pages. Do not expose private account/order content to indexing. Use canonical URLs and structured data only when accurate data exists.

## Required tests

- responsive navigation;
- keyboard/focus;
- public page rendering;
- product/cart/checkout journey;
- authenticated order/wardrobe access;
- no horizontal overflow;
- image loading/failure;
- Playwright critical paths;
- performance budget checks available in the repository.

# Sprint 16 — cross-platform QA and release closure

## Objective

Prove that the implemented frontend is complete, accessible, reliable and aligned with backend contracts before pilot/release claims are made.

## S16-01 screen inventory reconciliation

- Compare implemented routes against `docs/design/frontend-screen-inventory.md`.
- Mark implemented, deferred, blocked and intentionally removed screens.
- No undocumented omission is allowed.

## S16-02 visual regression

- Establish deterministic fixtures and approved viewport baselines.
- Cover Brand, Commerce and Hybrid examples.
- Avoid screenshot tests that depend on current time, network randomness or live provider content.

## S16-03 accessibility audit

Verify:

- contrast;
- target sizes;
- screen-reader names/roles;
- web focus order and traps;
- dynamic text/zoom;
- form errors;
- reduced motion;
- non-colour status communication;
- accessible modals/sheets.

## S16-04 low-end Android performance

Measure representative customer, merchant and captain flows on approved device classes. Inspect launch, scroll, image memory, navigation latency and long tasks. Optimize based on evidence rather than removing functionality blindly.

## S16-05 responsive and keyboard audit

Verify all web/admin pages and mobile-web routes at approved widths. Cover keyboard-only critical journeys.

## S16-06 offline/error/recovery audit

Inject:

- no network;
- slow network;
- timeout;
- unauthorized/expired session;
- partial section failure;
- stale data;
- duplicate mutation;
- provider unknown state where applicable.

Confirm truthful recovery paths.

## S16-07 privacy and permission audit

Validate:

- Wardrobe private default;
- Couple consent and revocation;
- Group/event-scoped sharing;
- location permissions and freshness;
- role guards;
- no privileged secrets in clients;
- minimum necessary personal data display.

## S16-08 complete COD pilot journey

Run and capture actual evidence for:

Customer order -> merchant alert/accept/pack/ready -> captain offer/pickup/deliver/COD -> customer completion -> admin visibility/recovery inspection.

Do not substitute mocks for physical-device or staging evidence when the pilot contract requires external execution.

## S16-09 release build and evidence

- Produce customer, merchant and captain release builds through repository-approved tooling.
- Produce admin/web production builds.
- Attach version/commit identity.
- Reconcile known defects.
- Update evidence manifest only for checks actually executed.
- Do not mark release/pilot GO without required signoffs.

## Required full validation

Use repository scripts and report exact results for:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:db
pnpm openapi:validate
pnpm build
```

Also run all frontend-specific unit, Maestro/mobile E2E, Playwright, accessibility and visual-regression suites introduced by the program.

## Final product comprehension test

Show representative Home and discovery surfaces to users for five seconds. The interface should communicate:

> all kinds of fashion from local shops

If users consistently interpret Vastra as an ethnic-only or wedding-only product, treat that as a blocking design defect in category balance and imagery.

## Closure report

Report:

- implemented screen count by application;
- blocked/deferred screens with reasons;
- critical journey status;
- accessibility findings;
- performance findings;
- device/browser coverage;
- CI/build results;
- known defects by severity;
- pilot evidence status;
- final go/no-go recommendation without overstating unexecuted checks.
