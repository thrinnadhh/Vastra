# Vastra frontend UI/UX implementation roadmap

Status: approved implementation plan  
Design source of truth: `design-system/vastra/MASTER.md`  
Execution prompts: `codex/prompts/frontend/`

## Product direction

Vastra uses one shared design system with three controlled presentation modes:

- **Brand** — Krishna-inspired cosmic warmth for emotional, editorial and celebratory moments.
- **Commerce** — clean, modern and category-neutral shopping and operational interfaces.
- **Hybrid** — a commerce screen containing one or two controlled brand moments.

The visual formula is:

> warm Indian soul + cosmic royal blue + plum + peacock teal + restrained gold + modern fashion photography + clear commerce structure

The interface must communicate all local fashion, not only ethnic or festive clothing. Initial discovery surfaces must visibly include women, men, kids, western, casual, office, ethnic, footwear and accessories.

## Global implementation constraints

1. Consume `@vastra/design-tokens`; do not add raw screen-specific colours when a semantic token exists.
2. Add shared primitives and shells before composing feature screens.
3. Keep product workflows, API contracts, state machines, authorization and RLS authoritative.
4. Do not invent backend capabilities to complete a visual design.
5. Every screen requires loading, empty, error, offline and session-expired behaviour where applicable.
6. Android touch targets are at least 48 x 48 dp, iOS targets at least 44 x 44 pt, with at least 8 dp separation.
7. Normal text contrast is at least 4.5:1.
8. Decorative assets are non-interactive, hidden from accessibility traversal and disabled or simplified for reduced motion.
9. Customer, merchant and captain mobile applications use native React Native primitives. Admin uses accessible web primitives.
10. No direct network requests inside presentational components. Use feature hooks and typed clients.
11. Server state belongs in the repository-approved query/cache layer; local ephemeral state must remain local.
12. A screen must not bypass an invalid backend state merely to make the UI flow work.
13. Couple and Groups remain separate products. Couple is private, mutual, exactly two people and never a discovery/dating surface.
14. Wardrobe items are private by default and shared only through explicit item/event/context actions.
15. Each ticket gets its own branch, focused tests, review and commit.

## Presentation-mode allocation

| Surface | Mode |
|---|---|
| Splash, welcome, brand story | Brand |
| Login, OTP, profile setup | Commerce with restrained brand header |
| Customer Home | Hybrid |
| Search, categories, listings, product, cart, checkout | Commerce |
| Order confirmation and delivered success | Brand moment inside Commerce |
| Wardrobe Home | Hybrid |
| Wardrobe management | Commerce |
| Couple introduction and final look | Brand |
| Couple planning and consent | Commerce |
| Groups introduction and final event look | Brand |
| Group management, voting and readiness | Commerce |
| Merchant, captain and admin | Commerce/operational only |
| Marketing website Home | Hybrid |

---

# Sprint 1R — approved visual-system revision

## Goal

Extend Sprint 1 with the approved cosmic-blue two-layer architecture before page composition begins.

## Tickets

### S1R-01 — cosmic colour system

- Add cosmic navy, royal blue, peacock teal, magenta and warm-gold primitive ramps.
- Add semantic roles for brand background, brand foreground, information emphasis and decorative sparkle.
- Maintain accessible light and dark themes.
- Add contrast tests for canonical colour pairs.

### S1R-02 — presentation-mode contracts

- Add `brand`, `commerce` and `hybrid` presentation definitions.
- Define decoration, background, heading and motion intensity for each mode.
- Export platform-neutral presentation tokens.

### S1R-03 — brand ornament policy

Define usage contracts for:

- arch frame;
- flute divider;
- peacock accent;
- textile pattern;
- cosmic sprinkle;
- editorial hero;
- trust strip.

Decorations must never obscure text, product imagery or controls.

### S1R-04 — logo and asset contract

Reserve asset variants:

1. full opening illustration;
2. horizontal wordmark with flute;
3. compact mark;
4. monochrome notification mark;
5. app icon;
6. web favicon.

Do not use the full illustration at small sizes.

### S1R-05 — shared shells and test contracts

Specify:

- `BrandExperienceShell`;
- `CommerceScreenShell`;
- `HybridScreenShell`;
- safe-area and keyboard behaviour;
- reduced-motion variants;
- accessibility and screenshot-test expectations.

## Exit criteria

- Typecheck, lint, unit tests and build pass.
- Every future screen can declare an explicit presentation mode.
- No third uncontrolled visual mode exists.

---

# Sprint 2 — opening, authentication and onboarding

## Screens

1. Splash
2. Welcome
3. Shop local
4. Fashion for everyone
5. Style preference selection
6. Size preferences
7. Budget preferences
8. Location explanation
9. Location permission denied
10. Manual location selection
11. Phone login
12. OTP verification
13. Profile setup
14. Service-area unavailable
15. Session expired

## Tickets

- S2-01 app launch state and splash composition
- S2-02 first-launch onboarding pager
- S2-03 authentication shell and phone validation
- S2-04 OTP states, resend and recovery
- S2-05 optional preference capture
- S2-06 location permission and manual fallback
- S2-07 returning-user bypass and session expiry
- S2-08 accessibility, device and screenshot tests

## Exit criteria

A new user understands local fashion, broad category coverage and permission purpose; a returning user reaches the correct authenticated route without replaying onboarding.

---

# Sprint 3 — navigation and shared customer UI

## Goal

Replace temporary local route switches with production customer navigation and shared components.

## Navigation

- Auth stack
- Main tabs: Home, Discover, Wardrobe, Orders, Profile
- Nested shop/product stack
- Checkout stack
- Returns/support stack
- Couple and Groups nested stacks

## Tickets

- S3-01 navigation contracts and route types
- S3-02 app header, bottom tabs and safe-area shell
- S3-03 buttons, inputs, icon buttons and focus/press states
- S3-04 cards, chips, prices and badges
- S3-05 loaders, empty/error/offline states and toast
- S3-06 confirmation modal and bottom sheet
- S3-07 API client/error mapping boundary
- S3-08 navigation and component tests

## Exit criteria

No feature screen defines its own global navigation, raw button system or duplicated server-error mapping.

---

# Sprint 4 — customer Home and local discovery entry

## Screens

1. Home
2. Location selector sheet
3. Campaign collection
4. Nearby shops
5. Category hub
6. Occasion hub
7. Budget hub
8. Trend zone
9. Recently viewed
10. No nearby shops
11. Shop closed state

## Home composition

- location and search;
- one rich campaign banner;
- women, men, kids, ethnic, western, footwear and accessories;
- nearby stores;
- trending near user;
- office, college, casual and festive occasions;
- price bands;
- complete-the-look entry;
- trust strip.

## Tickets

- S4-01 Home data model and skeleton
- S4-02 campaign and editorial hero components
- S4-03 category and occasion rows
- S4-04 nearby-shop and delivery-time cards
- S4-05 trends, budgets and recently viewed
- S4-06 empty/closed/offline/personalization states
- S4-07 responsive, performance and analytics hooks
- S4-08 Home E2E journey

---

# Sprint 5 — search, categories and shop experience

## Screens

1. Discover Home
2. Search suggestions
3. Search results
4. Product results
5. Shop results
6. Look results
7. Filters
8. Sort
9. No results
10. Shop detail
11. Shop catalogue
12. Collection page
13. Product grid

## Tickets

- S5-01 typed search query and URL/state contract
- S5-02 search suggestions and recent searches
- S5-03 results tabs and pagination
- S5-04 filter/sort bottom sheets
- S5-05 nearby shop directory and cards
- S5-06 shop detail and catalogue
- S5-07 collection and product-grid reuse
- S5-08 no-result, stale and retry states
- S5-09 search/shop E2E and accessibility

---

# Sprint 6 — product detail and trust

## Screens

1. Product detail
2. Image gallery
3. Fabric close-up
4. Colour selection
5. Size selection
6. Size guide
7. Variant unavailable
8. Reviews
9. Customer photos
10. Similar styles
11. Complete the look
12. Shop and quality information

## Tickets

- S6-01 product-detail query and route contract
- S6-02 media gallery and image optimisation
- S6-03 variant, colour, size and stock state
- S6-04 price, discount and delivery information
- S6-05 fit, fabric, colour-accuracy and return trust
- S6-06 reviews and customer media
- S6-07 similar products and complete-the-look
- S6-08 product E2E, accessibility and performance

---

# Sprint 7 — cart, address, checkout and payment

## Screens

1. Cart
2. Empty cart
3. One-shop warning
4. Address list
5. Add address
6. Edit address
7. Checkout quote
8. Fee breakdown
9. Coupon entry
10. Payment method
11. COD confirmation
12. Online-payment processing
13. Payment failed
14. Payment retry
15. Order placement
16. Order confirmation

## Tickets

- S7-01 cart state and one-shop invariant
- S7-02 quantity/removal and stock refresh
- S7-03 address CRUD UI and validation
- S7-04 checkout-quote integration
- S7-05 transparent fee and coupon presentation
- S7-06 COD placement and idempotency UI
- S7-07 online payment processing/retry UI
- S7-08 confirmation brand moment
- S7-09 checkout E2E and duplicate-submit tests

---

# Sprint 8 — orders, tracking, cancellation, return and refund

## Screens

1. Orders list
2. Active order detail
3. Order timeline
4. Merchant preparation
5. Captain assigned
6. Out for delivery
7. Delivery OTP
8. Delivered
9. Cancellation
10. Failed delivery
11. Return eligibility
12. Return reason/item selection
13. Evidence upload
14. Return status
15. Merchant inspection status
16. Refund initiated
17. Refund completed
18. Refund failed

## Tickets

- S8-01 order list and pagination
- S8-02 order detail and state-to-copy mapping
- S8-03 timeline and delivery tracking
- S8-04 OTP and customer-contact states
- S8-05 cancellation eligibility and confirmation
- S8-06 return request and evidence
- S8-07 return/refund status
- S8-08 delivered celebration and reorder entry
- S8-09 order lifecycle E2E

---

# Sprint 9 — Digital Wardrobe

## Screens

1. Wardrobe Home
2. Wardrobe categories
3. Add wardrobe item
4. Upload image
5. Add purchased item
6. Item detail
7. Item edit
8. Visibility settings
9. Outfit suggestions
10. Mood styling
11. Colour matching
12. Saved looks
13. Recently worn
14. Missing-item recommendations

## Tickets

- S9-01 wardrobe navigation and private-default contract
- S9-02 item list, categories and filters
- S9-03 add/upload/purchased-item flows
- S9-04 metadata editing and image handling
- S9-05 item visibility controls
- S9-06 rule-based outfit suggestions
- S9-07 colour and mood styling
- S9-08 saved looks and nearby missing items
- S9-09 privacy, authorization and E2E tests

---

# Sprint 10 — Vastra Couple

## Screens

1. Couple introduction
2. Invite partner
3. Invite through link/code/QR
4. Invitation received
5. Accept/decline
6. Couple Home
7. Create plan
8. Select wardrobe items
9. Waiting for partner
10. Shared wardrobe
11. Coordinated suggestions
12. Matching/complementary/same-theme modes
13. Replace item
14. Reactions
15. Nearby missing products
16. Final look
17. Saved plans
18. Disconnect

## Tickets

- S10-01 consent, connection and one-active-partner contract
- S10-02 invitation UI and deep-link states
- S10-03 Couple Home and plan lifecycle
- S10-04 explicit wardrobe sharing
- S10-05 side-by-side recommendations
- S10-06 reactions and approval
- S10-07 nearby product completion
- S10-08 final brand presentation
- S10-09 disconnect/revoke access
- S10-10 privacy, abuse prevention and E2E

---

# Sprint 11 — Vastra Groups

## Screens

1. Groups Home
2. Create group
3. Invite members
4. Invitation received
5. Group Home
6. Members and roles
7. Create event
8. Dress code
9. Colour palette
10. Share item for group/event
11. Submit member look
12. Group gallery
13. Coordination feedback
14. Voting
15. Change request
16. Readiness tracker
17. Group shopping list
18. Final event look
19. Leave group
20. Delete group

## Tickets

- S11-01 group membership and role contract
- S11-02 create/invite/join/leave UI
- S11-03 event lifecycle
- S11-04 palette and dress-code editor
- S11-05 event-scoped wardrobe sharing
- S11-06 member submissions and gallery
- S11-07 voting and change requests
- S11-08 readiness and shopping list
- S11-09 final brand presentation
- S11-10 permissions and multi-member E2E

---

# Sprint 12 — merchant application

## Screens

- authentication/readiness;
- approval/KYC/suspension states;
- notification permission and ringtone test;
- urgent order alert;
- order inbox and details;
- accept/reject and reason;
- preparation time and packing checklist;
- ready for pickup and handover;
- inventory and stock adjustment;
- offline sale;
- incoming returns and inspection;
- shop status, hours, profile and support.

## Tickets

- S12-01 merchant navigation and operational shell
- S12-02 readiness and permissions
- S12-03 urgent alert and multi-device handling
- S12-04 order inbox and decision
- S12-05 preparation, packing and pickup
- S12-06 inventory and movements
- S12-07 offline sale
- S12-08 returns and inspection
- S12-09 shop controls/profile/support
- S12-10 merchant journey E2E and device tests

---

# Sprint 13 — captain application

## Screens

- authentication/readiness;
- online/offline and location freshness;
- delivery offer and countdown;
- active delivery overview;
- merchant navigation and pickup code;
- customer navigation and OTP;
- COD collection;
- completion;
- failure/escalation states;
- earnings, COD reconciliation, payout and profile.

## Tickets

- S13-01 captain navigation and high-attention shell
- S13-02 availability/location states
- S13-03 offer lifecycle
- S13-04 pickup workflow
- S13-05 delivery and OTP workflow
- S13-06 COD collection and completion
- S13-07 failure and support escalation
- S13-08 earnings/reconciliation/profile
- S13-09 captain journey E2E and physical-device tests

---

# Sprint 14 — admin dashboard

## Pages

- authentication and MFA;
- operations dashboard;
- global search;
- orders and recovery;
- merchants and KYC;
- captains and assignments;
- returns and refunds;
- finance, settlement and COD;
- support cases;
- audit log;
- configuration and feature flags.

## Tickets

- S14-01 admin shell, routing and permission guards
- S14-02 operations dashboard and counters
- S14-03 global search
- S14-04 order detail and recovery actions
- S14-05 merchant management
- S14-06 captain management
- S14-07 returns and refunds
- S14-08 finance and COD
- S14-09 cases and audit
- S14-10 configuration
- S14-11 keyboard, responsive and Playwright E2E

---

# Sprint 15 — customer website

## Pages

- immersive Home;
- nearby-store directory;
- store page;
- category and collection;
- product detail;
- cart and checkout;
- order tracking;
- Wardrobe;
- Style Together;
- Couple and Groups landing pages;
- profile and support.

## Tickets

- S15-01 web shell and responsive tokens
- S15-02 immersive but performant Home
- S15-03 catalogue/store/product responsive reuse
- S15-04 cart/checkout/order web flows
- S15-05 Wardrobe and Style Together web
- S15-06 SEO, accessibility and performance
- S15-07 Playwright critical journeys

---

# Sprint 16 — cross-platform QA and release closure

## Tickets

- S16-01 screen inventory reconciliation
- S16-02 visual-regression baselines
- S16-03 accessibility audit
- S16-04 low-end Android performance audit
- S16-05 responsive and keyboard audit
- S16-06 offline/error/recovery audit
- S16-07 privacy and permission audit
- S16-08 end-to-end COD pilot journey
- S16-09 release build and evidence

## Required validation

- customer mobile E2E;
- merchant mobile E2E;
- captain mobile E2E;
- admin Playwright E2E;
- physical Android matrix;
- accessibility checks;
- visual regression;
- full repository CI;
- no unresolved critical/high defects.

---

# Dependency and parallelization map

## Sequential foundation

S1R -> S2 -> S3

Shared tokens, route contracts, shells and primitives have a single owner.

## Parallel after Sprint 3 contracts freeze

- Customer discovery: S4-S6
- Customer transaction: S7-S8
- Wardrobe: S9
- Merchant: S12
- Captain: S13
- Admin: S14
- Website shell: S15-01

## Requires Wardrobe contract

S9 -> S10 -> S11

Couple and Groups may share lower-level wardrobe primitives but must not share relationship or membership domain rules.

## Integration order

1. Shared foundation
2. Customer COD vertical slice
3. Merchant fulfilment
4. Captain delivery
5. Admin observation/recovery
6. Wardrobe
7. Couple
8. Groups
9. Website
10. Closure

# Per-ticket completion response

Codex must report:

- objective completed;
- files changed;
- routes/screens added;
- API contracts consumed;
- tests added;
- commands and results;
- screenshots/device evidence where applicable;
- accessibility considerations;
- risks or deferred work.
