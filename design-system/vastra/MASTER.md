# Vastra master design system

Status: approved Sprint 1 source of truth

## Product experience

Vastra is a hyperlocal fashion marketplace. The interface must feel like entering a warm, living fashion complex rather than browsing a generic marketplace catalogue.

The experience combines:

- editorial fashion discovery;
- the clarity and speed of local commerce;
- the intimacy of a personal wardrobe;
- trusted nearby-store fulfilment;
- private consent-based Couple and Group styling.

## Experience promise

Every core surface should help the customer answer four questions quickly:

1. What looks good for my occasion or mood?
2. Is it genuinely available near me?
3. Can I trust the product, shop, fit, and return promise?
4. What is the simplest next action?

## Design principles

### 1. Fashion first, commerce clear

Lead with expressive product photography and curated stories, then expose price, availability, delivery time, and the primary action without forcing the customer to decode the screen.

### 2. Warmth without clutter

Use warm ivory surfaces, plum brand accents, terracotta highlights, soft depth, and generous breathing room. Avoid filling every area with gradients, glass effects, badges, or animation.

### 3. One primary action

Every screen has one visually dominant action. Secondary actions remain visible but subordinate. Destructive actions are isolated and require confirmation.

### 4. Local availability is a feature

Distance, delivery estimate, shop identity, live stock, and store trust must remain visible at decision points.

### 5. Privacy by default

Wardrobe items are private by default. Couple and Group sharing requires explicit acceptance and item-level or event-level sharing. Disconnecting or revoking access removes visibility immediately.

### 6. Motion explains

Motion communicates hierarchy, cause and effect, or spatial continuity. It never blocks interaction or competes with product imagery.

### 7. Accessible by construction

Normal text contrast is at least 4.5:1, touch targets are at least 48 x 48 dp on Android, dynamic text is supported, and colour is never the only state indicator.

## Visual direction

### Style

- warm editorial commerce;
- modern Indian fashion without ornamental overload;
- softly layered surfaces rather than glass-heavy interfaces;
- rounded but not toy-like;
- immersive collection zones with restrained depth;
- high-quality imagery with consistent crops and colour treatment.

### Shopping-complex world

Customer discovery areas may use spatial names to create a coherent fashion world:

- Fashion Atrium;
- Wedding Avenue;
- Style Lane;
- Everyday Studio;
- Nearby Boutique Row;
- Couple Corner;
- Group Gallery.

These names are editorial labels, not replacements for clear navigation or accessibility labels.

## Colour system

### Brand palette

| Token | Value | Purpose |
| --- | --- | --- |
| plum-900 | `#35144F` | dark brand surfaces |
| plum-800 | `#4B1F6F` | pressed primary |
| plum-700 | `#5B2A86` | strong primary |
| plum-600 | `#6C3AA8` | default primary |
| plum-200 | `#DCC9EC` | decorative accent |
| plum-100 | `#EEE5F7` | selected/soft brand surface |
| terracotta-700 | `#8A3B22` | pressed warm accent |
| terracotta-600 | `#A64B2A` | accessible warm action/accent |
| terracotta-200 | `#EDC4B4` | soft warm surface |
| terracotta-100 | `#F8E8E1` | editorial warmth |
| gold-700 | `#8A4A00` | accessible warning text |
| gold-200 | `#F1D59A` | festive accent |
| ivory-50 | `#FFF9F5` | primary app background |
| sand-100 | `#F5EEE8` | secondary background |
| ink-950 | `#1D1B20` | primary text |
| ink-700 | `#475467` | secondary text |
| ink-500 | `#667085` | tertiary text on white only |
| border-200 | `#E4DAD3` | borders and dividers |
| success-700 | `#1F6F4A` | success text/actions |
| warning-700 | `#8A4A00` | warnings |
| danger-700 | `#B42318` | destructive/error |
| info-700 | `#245B8A` | informational state |

### Semantic light theme

- background: ivory-50;
- background-subtle: sand-100;
- surface: white;
- surface-raised: white;
- text-primary: ink-950;
- text-secondary: ink-700;
- text-tertiary: ink-500;
- border: border-200;
- primary: plum-600;
- primary-pressed: plum-800;
- primary-soft: plum-100;
- accent: terracotta-600;
- accent-soft: terracotta-100;
- success: success-700;
- warning: warning-700;
- danger: danger-700;
- focus-ring: plum-600.

### Semantic dark theme

Dark mode must remain warm rather than becoming neutral black:

- background: `#18131B`;
- background-subtle: `#211924`;
- surface: `#2B2130`;
- surface-raised: `#35283B`;
- text-primary: `#FFF9F5`;
- text-secondary: `#D8CEDC`;
- text-tertiary: `#B8ACBD`;
- border: `#4A3A50`;
- primary: `#C9A7E6`;
- primary-pressed: `#B488D8`;
- primary-soft: `#3E2A4A`;
- accent: `#E6A88D`;
- accent-soft: `#4B2D27`;
- success: `#79C99E`;
- warning: `#F1C56C`;
- danger: `#F29A92`;
- focus-ring: `#DCC9EC`.

## Typography

### Font strategy

- Display and editorial headings: `DM Serif Display`, Georgia fallback.
- Product UI, body, forms, and navigation: `Inter`, system sans-serif fallback.
- Prices, timers, counts, and tabular data: Inter with tabular numerals.

The mobile apps must not block rendering while custom fonts load. Use system fallbacks immediately and swap when fonts are available.

### Type roles

| Role | Mobile size/line | Web size/line | Weight |
| --- | --- | --- | --- |
| display-large | 40/48 | 64/72 | 400 serif |
| display-medium | 32/40 | 48/56 | 400 serif |
| headline-large | 28/36 | 36/44 | 600 sans |
| headline-medium | 24/32 | 30/38 | 600 sans |
| title-large | 20/28 | 24/32 | 600 sans |
| title-medium | 18/26 | 20/28 | 600 sans |
| body-large | 16/24 | 18/28 | 400 sans |
| body-medium | 14/22 | 16/24 | 400 sans |
| label-large | 14/20 | 14/20 | 600 sans |
| label-medium | 12/18 | 12/18 | 600 sans |
| caption | 12/18 | 12/18 | 400 sans |

Body copy must not be rendered below 14 px. Primary mobile form controls use at least 16 px text.

## Spacing and layout

Use a 4/8 dp rhythm:

- 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96.

Mobile page gutters:

- compact phone: 16;
- standard phone: 20;
- tablet: 32;
- desktop content: 40 to 64 with a maximum content width of 1280.

Breakpoints:

- compact: 0 to 374;
- phone: 375 to 767;
- tablet: 768 to 1023;
- desktop: 1024 to 1439;
- wide: 1440 and above.

No fixed bottom action or tab bar may obscure scroll content. Safe-area insets are mandatory.

## Shape

- button: 14;
- input: 14;
- card: 18;
- product image: 16;
- sheet top corners: 24;
- modal: 24;
- pill: 999.

Use pills only for chips, compact statuses, and filters. Do not turn every card or button into a pill.

## Elevation

Use four elevation levels only:

- none: flat sections and embedded content;
- low: product/shop cards;
- medium: sticky controls and dropdowns;
- high: sheets and modals.

Shadows remain warm-neutral and subtle. Borders carry most hierarchy in dense operational surfaces.

## Motion

### Timing

- instant feedback: 80 to 120 ms;
- micro interaction: 160 to 220 ms;
- sheet/modal enter: 260 to 320 ms;
- page or shared-element transition: maximum 400 ms;
- exit: approximately 65 percent of enter duration.

### Curves

- standard: `cubic-bezier(0.2, 0, 0, 1)`;
- emphasized enter: `cubic-bezier(0.05, 0.7, 0.1, 1)`;
- emphasized exit: `cubic-bezier(0.3, 0, 0.8, 0.15)`.

Animate transform and opacity. Do not animate width, height, top, or left for routine interface motion.

Reduced-motion mode removes parallax, large translations, and stagger. It retains brief opacity feedback where needed for state comprehension.

## Iconography

- Use one vector icon family per app surface.
- Default style: rounded outline, 2 px stroke.
- Structural navigation icons must never use emoji.
- Icon sizes: 16, 20, 24, and 32.
- Every icon-only control requires an accessibility label and at least a 48 x 48 dp touch target on Android.
- Active bottom-navigation state may use the filled counterpart of the same icon family.

## Photography and imagery

Product imagery is the visual hero.

- use accurate colour and neutral lighting;
- reserve image aspect ratio before load;
- use 4:5 for product cards and 3:4 or 4:5 for product detail;
- include front, back, fabric close-up, and worn view where possible;
- show real shop context selectively to reinforce local trust;
- avoid excessive text overlays on product images;
- use WebP/AVIF on web and appropriately resized mobile assets;
- lazy-load below-the-fold imagery;
- provide meaningful alt text/accessibility labels.

## Component language

### Buttons

- minimum height: 48;
- primary uses solid primary colour with white text in light mode;
- secondary uses primary-soft surface and primary text;
- tertiary is text/icon only with a full touch target;
- destructive uses danger styling and confirmation;
- async actions disable immediately and show progress.

### Inputs

- minimum height: 52;
- visible label; placeholder never acts as the only label;
- helper and error text appear below the field;
- validate on blur or submit, not on every keystroke;
- focus ring is visible and token-driven.

### Cards

- product cards privilege image, name, price, shop/delivery trust, and one secondary action;
- shop cards feel like digital storefronts;
- operational cards use flatter surfaces and stronger status hierarchy;
- pressed states must not shift surrounding layout.

### Feedback

Every data surface defines loading, empty, error, offline, permission-denied, and session-expired states. Errors state what happened and provide a recovery action.

## Navigation

- customer bottom navigation: maximum five labelled items;
- back behaviour remains predictable;
- primary journeys use typed stack navigation;
- notifications deep-link to the relevant order, merchant alert, delivery, Couple plan, or Group event;
- hover is supplementary on web and never the only way to discover an action.

## Couple and Group boundaries

### Couple

- exactly two accepted users;
- one active Couple connection per user in the MVP;
- private invitation only;
- no stranger search or public profile;
- wardrobe items private by default;
- explicit item/event sharing;
- immediate disconnect and access revocation.

### Groups

- separate feature and information architecture;
- multiple invite-only members;
- event, role, palette, readiness, and voting concepts;
- users may belong to multiple Groups;
- wardrobe sharing is group-specific or event-specific;
- Couple membership is never inferred from Group membership.

## Accessibility and quality gates

- normal text contrast at least 4.5:1;
- large text and meaningful large icons at least 3:1;
- Android targets at least 48 x 48 dp; iOS at least 44 x 44 pt;
- minimum 8 dp between adjacent targets;
- dynamic type/system scaling must not hide actions;
- focus order matches visual order;
- reduced motion is supported;
- all statuses include text or icon, not colour alone;
- safe areas and landscape are tested;
- skeletons replace blocking spinners for content expected to take more than one second;
- each screen has a clear escape/back route.

## Anti-patterns

Do not:

- imitate a grocery app with dense promotional tiles;
- use purple gradients on every section;
- use emoji as navigation icons;
- use glassmorphism behind body text;
- place low-contrast grey text on warm backgrounds;
- overload product cards with badges;
- use fake urgency or fake stock scarcity;
- use decorative animations that delay shopping;
- mix Couple and Group permissions;
- expose a full wardrobe automatically;
- hard-code raw colours inside screens once tokens exist;
- create more than one dominant CTA per screen.

## Governance

- This file is the global source of truth.
- Page-specific overrides belong in `design-system/vastra/pages/` and must explain why they diverge.
- New raw colour, spacing, radius, shadow, motion, or z-index values require design-system review.
- Customer, merchant, captain, admin, Couple, and Group products share semantic tokens while retaining role-specific layouts.
