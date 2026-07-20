# Vastra UI pre-delivery checklist

Use this checklist for every customer, merchant, captain, admin, Wardrobe, Couple, Group, mobile-web, and desktop-web delivery.

## Process

- [ ] Read `design-system/vastra/MASTER.md`.
- [ ] Check for an approved page-specific override.
- [ ] Verify the screen maps to an approved product capability.
- [ ] Review loading, empty, error, offline, permission, and session states.
- [ ] Test at 375 px width and in landscape.
- [ ] Test on a large phone and tablet.
- [ ] Test desktop at 1024, 1440, and 1920 where applicable.
- [ ] Test reduced motion.
- [ ] Test the largest supported system text size.
- [ ] Test light and dark contrast separately.

## Accessibility

- [ ] Normal text contrast is at least 4.5:1.
- [ ] Large text and meaningful large icons meet at least 3:1.
- [ ] Colour is not the only status indicator.
- [ ] Android touch targets are at least 48 x 48 dp.
- [ ] iOS touch targets are at least 44 x 44 pt.
- [ ] Adjacent touch targets have at least 8 dp separation.
- [ ] Icon-only controls have descriptive accessible names.
- [ ] Images have meaningful labels or are marked decorative.
- [ ] Focus order matches visual order.
- [ ] Web flows are keyboard operable.
- [ ] Modals trap focus and restore focus on close.
- [ ] Form errors are announced and focus the first invalid field.
- [ ] Dynamic text does not hide primary actions.

## Visual quality

- [ ] No emoji is used as a structural icon.
- [ ] Icons use one approved family and consistent stroke style.
- [ ] No raw colours, spacing, radii, shadows, motion durations, or z-index values are introduced without approval.
- [ ] Product images use a reserved aspect ratio.
- [ ] Cards do not shift layout when pressed.
- [ ] Each screen has one dominant primary action.
- [ ] Product cards contain no more than two badges.
- [ ] Gradients preserve text contrast and are not used as decoration everywhere.
- [ ] Shop and product imagery follows the photography rules.

## Interaction

- [ ] Tap or click feedback appears within 100 ms.
- [ ] Micro-interactions complete in approximately 150 to 300 ms.
- [ ] Exits are faster than entrances.
- [ ] Animations use transform and opacity rather than layout properties.
- [ ] User input is never blocked by decorative motion.
- [ ] Reduced-motion mode removes parallax, large travel, and stagger.
- [ ] Async actions disable duplicate submission and show progress.
- [ ] Disabled controls are semantically disabled and visibly distinct.
- [ ] Gesture-only actions have a visible control alternative.

## Layout and responsive behaviour

- [ ] Safe-area insets are respected.
- [ ] Scroll content is not hidden behind fixed headers, tab bars, or CTA bars.
- [ ] No horizontal scrolling occurs on phone layouts.
- [ ] Gutters adapt by breakpoint.
- [ ] Long text wraps or exposes its full value.
- [ ] Body text remains readable and is not below 14 px.
- [ ] Mobile form input text is at least 16 px.
- [ ] Long-form desktop content has a controlled line length.
- [ ] Z-index values use the approved layer scale.

## Performance

- [ ] Product media uses appropriate WebP/AVIF or resized mobile assets.
- [ ] Non-critical imagery is lazy-loaded.
- [ ] Image dimensions/aspect ratios prevent layout shift.
- [ ] Lists with more than approximately 50 rows are virtualised where appropriate.
- [ ] Search and high-frequency events are debounced or throttled.
- [ ] Content expected to take longer than one second uses geometry-matched skeletons.
- [ ] Slow-network and offline fallbacks are present.
- [ ] Motion stays within the main-thread frame budget.

## Forms and feedback

- [ ] Every field has a visible label.
- [ ] Helper text explains non-obvious requirements.
- [ ] Validation occurs on blur or submit rather than noisy per-keystroke errors.
- [ ] Errors state the cause and recovery action.
- [ ] Required fields are marked.
- [ ] Semantic input types trigger the correct keyboard.
- [ ] Long forms preserve drafts where required.
- [ ] Unsaved modal or sheet dismissal is confirmed.
- [ ] Destructive actions are isolated and confirmed.
- [ ] Toasts do not steal focus and are announced politely.

## Navigation

- [ ] Bottom navigation contains no more than five labelled destinations.
- [ ] Back behaviour is predictable.
- [ ] Primary flows have a visible escape route.
- [ ] Notifications deep-link to the correct context.
- [ ] Hover is not the only way to expose an action.
- [ ] Active navigation is indicated by label/icon treatment in addition to colour.

## Trust and commerce

- [ ] Price, shop, stock, distance, delivery estimate, and return information are accurate.
- [ ] Urgency is based on real inventory or operating data.
- [ ] Fees are visible before order placement.
- [ ] COD and online payment are clearly distinguished.
- [ ] Product quality and colour-accuracy claims are evidence-based.
- [ ] Error states preserve safe customer progress.

## Wardrobe, Couple, and Group privacy

- [ ] New wardrobe items default to private.
- [ ] Couple sharing requires an accepted connection.
- [ ] Couple and Group remain separate experiences.
- [ ] Group sharing is scoped to the selected group or event.
- [ ] Users can revoke sharing.
- [ ] Disconnecting or leaving removes future access.
- [ ] No public stranger discovery is introduced.
- [ ] Shared previews do not expose unselected wardrobe items.

## Approval

- [ ] Product owner approved scope and wording.
- [ ] Design owner approved token and component-system usage.
- [ ] Accessibility review completed.
- [ ] Engineering confirmed implementation feasibility.
- [ ] All critical findings are fixed or the screen is not released.
