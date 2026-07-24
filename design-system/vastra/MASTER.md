# Vastra design-system master

Status: approved implementation contract  
Presentation baseline: light-theme MVP with dark-theme compatibility  
Code source: `packages/design-tokens`

## Identity

Vastra is a modern hyperlocal marketplace for all local fashion. The experience combines:

- warm Indian soul;
- cosmic navy and royal blue;
- plum decision actions;
- peacock-teal success;
- restrained warm gold;
- modern fashion photography;
- clear commerce and operational structure.

The product must visibly support women, men, kids, western, casual, office, ethnic,
footwear, accessories, and occasion wear. Visual treatment must never make Vastra look
limited to ethnic, wedding, or festive shopping.

## Sources of truth

Use these together, in precedence order:

1. `docs/architecture/security-model.md`
2. `docs/product/mvp-scope.md`
3. `docs/design/design-system.md`
4. `docs/design/frontend-visual-contract.md`
5. `packages/design-tokens`

Security and frozen product scope override visual ideas. Screens do not hard-code colour,
spacing, typography, shape, motion, or component dimensions when a token exists.

## Presentation modes

Every screen declares exactly one mode.

### Brand

Use for brief emotional moments such as splash, welcome, order confirmation, delivered
success, and selected editorial campaigns.

- Cosmic or royal backgrounds are allowed.
- One primary ornament family and one supporting accent are allowed.
- Decoration never delays authentication, session bootstrap, navigation, or recovery.
- Reduced motion uses a static equivalent.
- One dominant action remains visible.

### Commerce

Use for search, shops, products, cart, checkout, orders, account, and every merchant,
captain, and admin operational screen.

- Warm neutral and ivory surfaces dominate.
- Plum owns primary purchase and decision actions.
- Royal blue owns information and selected navigation.
- Peacock teal owns success.
- Gold is a restrained premium/trust accent, never normal small body text.
- Decoration does not compete with media, price, stock, status, or the next action.

### Hybrid

Use for customer Home, Wardrobe Home, and selected collection or saved-look surfaces.

- Commerce structure remains primary.
- At most two Brand moments appear in one scrolling surface.
- Brand assets remain outside repeated product and shop grids.
- Reduced motion removes decorative travel, stagger, and parallax.

No fourth mode is permitted without an approved contract revision.

## Colour ownership

`@vastra/design-tokens` exports:

- primitive ramps;
- backward-compatible semantic keys;
- nested role families for Brand, action, information, success, warning, danger,
  premium, surfaces, text, borders, and per-application accents;
- light and dark theme composition.

Canonical foreground/background pairs are covered by automated WCAG AA contrast tests.
Colour is never the only status signal.

## Ornament policy

Supported ornaments are:

- arch frame;
- flute divider;
- peacock accent;
- textile pattern;
- cosmic sprinkle;
- editorial hero;
- trust strip.

All ornaments are decorative and hidden from accessibility traversal. They have explicit
mode and density limits, static reduced-motion variants, and may never obscure text,
controls, prices, status, or product imagery. Emoji is not a structural icon or
decorative substitute.

## Asset contract

The repository reserves, but does not fabricate:

1. opening illustration;
2. horizontal wordmark;
3. compact mark;
4. monochrome notification mark;
5. app icon;
6. favicon for an approved web surface.

Each approved asset must record owner, approval state, source format, exported sizes,
light/dark or monochrome behavior, accessibility semantics, and optimization limits.

## Shell contracts

### BrandExperienceShell

Safe-area aware, non-blocking, readable before media loads, deterministic under tests,
static under reduced motion, and limited to one dominant action plus a visible recovery
or exit path.

### CommerceScreenShell

Safe-area and keyboard aware on mobile, predictable header/back behavior, scrolling
content clear of navigation and sticky actions, and standard loading, empty, error,
offline/stale, permission, and session-expiry states.

### HybridScreenShell

All Commerce requirements plus explicit bounded Brand slots, lazy loading below the fold,
and stable media geometry.

## Accessibility and interaction

- Android targets: at least 48 × 48 dp.
- iOS targets: at least 44 × 44 pt.
- Adjacent mobile targets: at least 8 dp apart.
- Normal text contrast: at least 4.5:1.
- Large text and meaningful icons: at least 3:1.
- Web: visible focus and complete keyboard paths.
- Dynamic text or zoom must not hide the primary action.
- Async actions expose progress and block duplicate submission.
- Forms retain values after recoverable errors and announce useful errors.
- Decorative content is excluded from screen-reader traversal.

## Motion and performance

Motion is bounded, non-blocking, and limited to transform/opacity. Operational merchant,
captain, and admin screens do not use decorative motion. Product/editorial images reserve
stable aspect ratios and lazy-load below the fold. Reduced motion disables travel,
parallax, and stagger.

## Completion boundary

Sprint `FE-S1R` is complete when the package tests, lint, typecheck, build, repository
formatting, and relevant CI checks pass. This contract does not authorize feature-page
composition or production artwork.
