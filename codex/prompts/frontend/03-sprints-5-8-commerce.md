# Codex prompt pack — Sprints 5 to 8 customer commerce

Use the master contract and execute one roadmap ticket at a time.

# Sprint 5 — search, categories and local shops

## Objective

Build fast, understandable discovery that exposes products, shops and curated looks without losing the local-inventory advantage.

## Implementation requirements

- Search entry accepts existing supported query syntax only.
- Preserve query, tab, filter and sort state through navigation when practical.
- Use server pagination/cursors as defined by the API.
- Filters must map to actual indexed fields or documented backend capability.
- Clearly display shop distance, delivery estimate, open/closed state and availability where supplied.
- Use bottom sheets on mobile and accessible panels on web.
- Provide no-results recovery suggestions without inventing products.

## Shop detail

- Treat the shop as a modern digital showroom.
- Render business information, operating state, delivery estimate and catalogue.
- Do not show private merchant data.
- Disable ordering actions when the shop/order state disallows them.

## Required tests

- query submit and clear;
- tab/filter/sort state;
- pagination;
- no results;
- partial failures;
- closed shop;
- product/shop navigation;
- accessibility and focus restoration.

# Sprint 6 — product detail and trust

## Objective

Make product desire and purchase confidence stronger than decoration.

## Information hierarchy

1. media;
2. title and shop;
3. price/discount;
4. colour and size;
5. stock;
6. delivery estimate;
7. fabric/fit/quality;
8. return eligibility;
9. primary action;
10. related products.

## Requirements

- Route by stable product/variant identity from existing contracts.
- Keep colour and size selections synchronized with real variant availability.
- Do not allow add-to-cart without a valid selectable variant.
- Handle stale stock and price changes explicitly.
- Use optimized media with placeholders and retry.
- Trust labels such as verified photo, colour accuracy or quality check may appear only when backed by data.
- Complete-the-look may use curated or rule-based data that actually exists; label generic suggestions honestly.

## Required tests

- initial variant selection;
- unavailable size/colour;
- price and stock refresh;
- add-to-cart payload;
- image failure;
- return/trust conditions;
- related-product navigation;
- accessibility of gallery and selectors.

# Sprint 7 — cart, address, checkout and payment

## Objective

Complete a clear, retry-safe purchase flow using the existing order and payment contracts.

## Cart

- Preserve the one-shop-cart invariant.
- Revalidate stock, price and shop readiness.
- Handle quantity updates and removals idempotently where required.
- Explain why items cannot be combined across shops.

## Address

- Use the existing address schema and validation.
- Support list, select, add and edit.
- Do not store prohibited or unnecessary address data locally.
- Make serviceability failures actionable.

## Checkout quote

- Use server-derived item totals, delivery fee, platform fee, discount and payable total.
- Never calculate authoritative monetary values only on the client.
- Explain fees before order placement.

## COD

- Confirm the final payable amount and address.
- Prevent duplicate submits.
- Display idempotent/retry-safe progress copy.
- Navigate using the server-returned order identity.

## Online payment

- Keep provider secrets outside clients.
- Use existing payment-session contracts.
- Distinguish processing, success, declined, cancelled, timeout and unknown/reconciliation states.
- Do not mark success from client callback alone when backend verification is required.

## Required tests

- one-shop warning;
- stock/price change;
- address validation/serviceability;
- checkout totals;
- duplicate order submit;
- payment retry and unknown state;
- COD success;
- full customer purchase E2E.

# Sprint 8 — orders, tracking, cancellation, returns and refunds

## Objective

Give the customer a truthful, understandable post-purchase journey for every backend state.

## State mapping

Create one tested mapping from domain statuses to:

- customer-facing title;
- explanatory copy;
- icon/semantic colour;
- permitted actions;
- support escalation visibility.

Do not scatter status-string comparisons throughout screens.

## Tracking

- Render timeline from authoritative events/state.
- Display captain/location data only when permitted and available.
- Show stale-location warnings.
- Do not imply live tracking when polling or data freshness cannot support it.

## Cancellation

- Query/display eligibility.
- Require confirmation.
- Handle races where cancellation is no longer allowed.

## Returns and refunds

- Display eligibility and line-level quantities from backend rules.
- Validate evidence type/size before upload.
- Show merchant inspection, admin review and provider refund states accurately.
- Preserve failed/unknown refund recovery messaging.

## Required tests

- order list and detail states;
- timeline mapping;
- stale/no captain location;
- delivery OTP states;
- cancellation eligibility race;
- return evidence validation;
- partial/full refund states;
- failed refund;
- complete order lifecycle E2E.

## Visual rules for Sprints 5-8

- Commerce mode dominates.
- Plum remains the primary purchase CTA.
- Royal/cosmic blue is used for information, selected navigation and active delivery.
- Teal is success.
- Gold is a restrained premium/trust accent, not body text or routine borders.
- Cosmic sprinkles are limited to confirmation/delivered brand moments.

## Out of scope

- changing search ranking;
- introducing unsupported AI recommendations;
- changing payment providers;
- redesigning order state machines;
- implementing merchant or captain screens in customer tickets.
