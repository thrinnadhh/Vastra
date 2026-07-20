# Vastra frontend visual contract

Status: approved planning contract
Last reviewed: 2026-07-20

## Purpose

This document turns the approved Krishna-inspired cosmic direction into controlled,
implementable rules. It supplements `docs/design/design-system.md`; it does not itself
add token code or production artwork.

The intended impression is:

> warm Indian soul + cosmic royal blue + plum + peacock teal + restrained gold +
> modern fashion photography + clear commerce structure

Vastra must still read as a marketplace for all local fashion: women, men, kids,
western, casual, office, ethnic, footwear, accessories, and occasion wear.

## Visual architecture

Every screen declares one mode.

### Brand

Use for short emotional moments: splash, welcome, order confirmation, delivered
success, and selected editorial campaigns.

- cosmic/royal background treatments are allowed;
- one primary ornament family and one supporting accent are allowed;
- foreground contrast remains semantic and tested;
- interaction and session bootstrap must never wait for decoration or animation;
- provide a static reduced-motion form.

### Commerce

Use for search, shop, product, cart, checkout, orders, account, and all active merchant,
captain, and admin work.

- warm neutral/ivory backgrounds and clear surfaces dominate;
- plum is the primary purchase/decision role;
- royal/cosmic blue communicates information and selected navigation;
- peacock teal is success;
- gold is a restrained premium/trust accent, not small body text;
- decoration cannot compete with product media, price, status, or the next action.

### Hybrid

Use for customer Home, Wardrobe Home, and selected collection/look surfaces.

- Commerce structure remains primary;
- at most two Brand moments appear in a single scrolling surface;
- Brand assets must be outside repeated product/shop card grids;
- reduced motion removes decorative travel, stagger, and parallax.

No fourth presentation mode may be introduced without an approved design-contract
change.

## Semantic token intent

Sprint `FE-S1R-01` must implement these roles in `@vastra/design-tokens` without
hard-coding screen colours:

| Role family | Intent |
|---|---|
| `brand.background.*` | cosmic and royal Brand surfaces |
| `brand.foreground.*` | text/icon roles tested against Brand surfaces |
| `action.primary.*` | plum primary actions and interaction states |
| `information.*` | royal/cosmic informational and selection states |
| `success.*` | peacock-teal success states |
| `warning.*` | operational urgency without implying failure |
| `danger.*` | destructive/failure states |
| `premium.*` | restrained warm-gold accents |
| `surface.*` | background, elevated, inset, and overlay surfaces |
| `text.*` | primary, secondary, inverse, disabled, and link text |
| `border.*` | default, strong, selected, focus, and error boundaries |

The existing semantic keys remain compatible until a ticket migrates all consumers.
Exact values and foreground pairs require automated contrast tests. Light theme is the
MVP release requirement. Dark-theme compatibility may be retained, but full dark-theme
screen coverage is not a release gate unless separately approved.

## Ornament policy

| Ornament | Allowed use | Prohibited use |
|---|---|---|
| Arch frame | launch/editorial framing | repeated commerce cards or controls |
| Flute divider | one Brand transition | form separation or status indication |
| Peacock accent | compact Brand highlight | button/icon replacement |
| Textile pattern | low-contrast background crop | behind body text or product detail |
| Cosmic sprinkle | confirmation/celebration | operational, error, or repeated list UI |
| Editorial hero | Home/collection campaign | blocking launch or unbounded carousel |
| Trust strip | verified service/commerce facts | unsupported marketing claims |

Rules:

- ornaments are decorative and hidden from accessibility traversal;
- ornaments never obscure controls, copy, prices, status, or product imagery;
- motion uses transform/opacity and has a static reduced-motion variant;
- Commerce screens normally use no ornament; Hybrid uses at most two Brand moments;
- no emoji is a structural icon or decorative substitute.

## Asset contract

The asset manifest must reserve these variants without fabricating final binaries:

1. full opening illustration for launch/editorial use;
2. horizontal wordmark with flute for large headers/marketing contexts;
3. compact mark for application chrome;
4. monochrome notification mark for system notification contexts;
5. app icon in required platform sizes;
6. web favicon if a web surface is later approved.

Each manifest entry records owner, approval status, source format, exported sizes,
light/dark or monochrome behavior, alt/decorative semantics, and optimization limits.
The full illustration must not be scaled into compact chrome.

## Shared shell contracts

### BrandExperienceShell

- safe-area aware;
- bounded, optimized background assets;
- content remains readable before media loads;
- deterministic, skippable, non-blocking motion;
- one dominant action and a visible recovery/exit path.

### CommerceScreenShell

- safe-area and keyboard aware on mobile;
- predictable header/back behavior;
- scrolling content is not hidden by tabs or sticky CTAs;
- standard loading, empty, error, offline/stale, permission, and session states;
- operational variants prioritize status and next action.

### HybridScreenShell

- all Commerce shell requirements;
- explicit Brand slots with density limits;
- lazy loading below the fold;
- stable geometry while editorial/product media loads.

## Category and photography rules

- Early Home/discovery content must not appear ethnic-only or wedding-only.
- Use real inventory/category data where possible; fixtures remain test/dev-only.
- Product imagery uses reserved aspect ratios and truthful colour/quality claims.
- Modern casual, western, office, kids, footwear, accessories, and ethnic fashion must
  be visibly balanced over the first meaningful discovery experience.
- Do not label a generic collection as personalized or AI-recommended.

## Interaction and accessibility baseline

- Android targets are at least 48 × 48 dp; iOS targets at least 44 × 44 pt.
- Adjacent mobile targets retain at least 8 dp separation.
- Normal text contrast is at least 4.5:1; large text/meaningful icons at least 3:1.
- Web has visible focus and full keyboard paths.
- Colour is never the only status signal.
- Decorative content is excluded from screen-reader traversal.
- Dynamic text/zoom cannot hide the primary action.
- Async actions expose progress and prevent duplicate submission.
- Forms retain values after recoverable failures and announce useful errors.

## Approval boundary

`FE-S1R-*` may implement tokens, typed mode definitions, asset manifests, and shells.
It must not compose feature pages. Page tickets consume this contract only after the
token and shell checks pass.
