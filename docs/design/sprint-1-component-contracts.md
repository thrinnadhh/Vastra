# Sprint 1 shared component contracts

These are behavioural and visual contracts. They do not prescribe one implementation library across React Native and Next.js.

## Global rules

Every interactive component must provide:

- semantic role and accessible name;
- keyboard support on web;
- at least 48 x 48 dp Android or 44 x 44 pt iOS hit area;
- visible pressed, focused, disabled, loading, and error states where relevant;
- no layout shift during interaction;
- reduced-motion-safe behaviour;
- semantic token usage rather than raw colours and spacing.

## AppButton

Variants:

- primary;
- secondary;
- tertiary;
- destructive.

Contract:

- minimum height 48;
- one-line label by default;
- progress indicator replaces or accompanies the label without resizing the control;
- async submission disables duplicate activation immediately;
- icon placement and spacing are consistent;
- destructive actions require confirmation when state cannot be easily restored.

## AppIconButton

Contract:

- visual icon sizes are 16, 20, 24, or 32;
- hit target remains at least 48 x 48 on Android;
- accessibility label is mandatory;
- tooltip is mandatory on desktop when the visible icon has no text;
- pressed state changes opacity, state layer, or elevation without shifting layout.

## AppInput

Contract:

- visible label is mandatory;
- minimum height 52;
- helper text remains visible for complex fields;
- error appears next to the field and describes recovery;
- validation generally runs on blur or submit;
- correct semantic keyboard/input mode is used;
- first invalid field receives focus after failed submission;
- read-only and disabled are visually and semantically different.

## SearchField

Contract:

- minimum height 52;
- clear button has an accessible name;
- input is debounced for remote search;
- recent and suggested searches do not shift the field position;
- search remains usable with the software keyboard open;
- loading and no-result states are explicit.

## FilterChip

Contract:

- selected state includes text/icon/state, not colour alone;
- target remains touch accessible even when the visual pill is compact;
- removable chips expose a labelled removal control;
- long labels wrap or truncate with an accessible full value.

## ProductCard

Information order:

1. product image;
2. product name;
3. price and discount where truthful;
4. shop or local availability signal;
5. delivery estimate or stock signal;
6. wishlist or one secondary action.

Contract:

- 4:5 image area is reserved before media loads;
- image has meaningful alt text/accessibility label;
- card is not overloaded with more than two badges;
- urgency is based on real stock or operating data;
- price uses tabular numerals;
- pressed feedback does not resize the card.

## ShopCard

Contract:

- feels like a compact digital storefront;
- shows shop name, distance, delivery estimate, open/closed state, and primary category identity;
- closed state remains understandable without relying only on colour;
- store image uses a reserved aspect ratio;
- the primary action is entering the shop.

## CollectionCard

Contract:

- uses editorial imagery and a short readable label;
- gradient overlays exist only to preserve text contrast;
- label remains readable at large system text sizes;
- motion is optional and disabled under reduced motion.

## PriceDisplay

Contract:

- uses tabular numerals;
- distinguishes current price, original price, and truthful savings;
- screen-reader text communicates currency and discount clearly;
- does not use colour alone to identify a discount.

## StatusBadge

Contract:

- includes readable status text;
- optional icon reinforces state;
- status colour maps to semantic tokens;
- supports order, payment, delivery, return, refund, merchant, captain, Couple, and Group states;
- avoids exposing raw backend enum names when plain language is available.

## OrderCard

Contract:

- shows the latest meaningful status, next expected step, total, shop, and primary action;
- active and historical orders are visually distinct;
- failure states include a recovery/support action;
- long order identifiers are copyable but not dominant.

## Timeline

Contract:

- uses icon, label, and optional timestamp rather than colour alone;
- latest state is announced to screen readers;
- long histories can collapse without hiding the current state;
- future steps are visually subordinate and not presented as completed.

## EmptyState

Contract:

- explains why the area is empty;
- provides one useful next action where applicable;
- illustration is decorative unless it conveys information;
- never blames the user.

## ErrorState

Contract:

- states what failed in plain language;
- includes retry, edit, or support path;
- preserves user-entered data where safe;
- technical identifiers may be copyable but remain secondary.

## OfflineBanner

Contract:

- remains visible while connectivity is unavailable;
- does not block the whole interface when cached/degraded content is usable;
- explains which actions require connectivity;
- announces reconnection without stealing focus.

## Skeleton

Contract:

- matches final content geometry to reduce layout shift;
- uses reduced-motion-safe shimmer or static placeholders;
- is preferred over blocking spinners for content expected to load longer than one second.

## Toast

Contract:

- appears for transient confirmation or recoverable feedback;
- auto-dismisses in approximately 3 to 5 seconds when safe;
- does not steal focus;
- exposes an accessible live-region announcement;
- persistent failures use an inline error or alert instead.

## BottomSheet

Contract:

- top corners use the sheet radius token;
- scrim preserves foreground legibility;
- supports safe-area bottom inset;
- has a visible close or cancel route;
- confirms dismissal when unsaved work would be lost;
- drag is not the only dismissal method.

## Modal

Contract:

- traps focus on web;
- returns focus to the trigger after close;
- uses a clear title and primary action;
- destructive confirmation clearly states the consequence;
- large workflows become pages rather than oversized modals.

## BottomNavigation

Contract:

- maximum five destinations;
- every icon has a visible label;
- active state uses more than colour alone;
- safe area is respected;
- notifications may show compact count indicators without changing item width.

## AppHeader

Contract:

- respects the top safe area;
- preserves predictable back behaviour;
- title can grow with dynamic text;
- icon actions remain touch accessible;
- location and contextual status do not compete with the page title.

## Couple components

### CoupleConnectionCard

- shows accepted partner only;
- never provides public discovery;
- disconnect is secondary and confirmed;
- connection state is explicit.

### WardrobeShareControl

Visibility options:

- private;
- shared with accepted Couple partner;
- shared with selected Group;
- shared for one event.

Private is always the default.

### CoupleLookComparison

- displays both looks with equal visual weight;
- allows each user to change only permitted items;
- distinguishes matching, complementary, and shared-theme recommendations;
- missing nearby products remain secondary to owned wardrobe items.

## Group components

### GroupMemberGrid

- identifies owner, co-admin, and member roles;
- exposes readiness without ranking appearance;
- supports 3 to 10 members in the MVP without horizontal-only navigation.

### PaletteSelector

- shows colour names in addition to swatches;
- verifies foreground contrast for any applied UI labels;
- supports event-specific palettes.

### ReadinessTracker

- shows ready count, pending members, and required next actions;
- does not expose private wardrobe items unless explicitly shared;
- uses labels and icons in addition to colour.

## Admin components

- data tables support keyboard navigation, visible focus, pagination, and empty/error states;
- privileged actions require reason capture and confirmation;
- destructive and financial actions are visually isolated from navigation;
- audit context is visible before and after mutation;
- dense layouts still retain a minimum 16 px readable body size and accessible targets.
