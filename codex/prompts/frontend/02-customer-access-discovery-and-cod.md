# Codex prompt pack — customer access, discovery, and COD

Use `00-master-frontend-contract.md`. Execute exactly one named `FE-S03-*`, `FE-S04-*`,
or `FE-S05-*` ticket.

## Sprint 03 — access, location, and navigation

The authenticated tabs are Home, Discover, Style, Orders, and Profile. Cart,
favourites, and support are contextual routes. Do not add Couple/event-group routes or
a sixth tab.

Required behavior:

- bootstrap first launch and returning session concurrently with a non-blocking splash;
- phone/OTP validation, resend cooldown, wrong/expired code, rate limit, and recovery;
- explain location before permission; handle denied/blocked/GPS-off/manual/service-area
  paths without claiming serviceability early;
- keep category/size/budget preferences optional unless a current contract requires
  otherwise;
- revalidate session/role/resource state after deep links;
- preserve current Checkout and Orders behavior while replacing the temporary root.

Tests cover first/returning launch, session expiry, OTP timing and errors, location
fallback, selected tabs, typed routes, back behavior, safe areas, keyboard, touch
targets, and existing Checkout/Orders reachability.

## Sprint 04 — discovery, shops, and products

Home should communicate “all kinds of fashion from local shops” in the first meaningful
experience. Balance ethnic/occasion content with modern casual, western, office, kids,
footwear, and accessories when real data is available.

Requirements:

- use existing discovery, catalogue, shop, product, variant, stock, and favourites
  contracts;
- preserve query/filter/sort/pagination state where practical;
- render server-backed distance, delivery, shop open/closed, price, and stock data;
- require a valid available variant before add-to-cart;
- show stale price/stock and partial section failures explicitly;
- use dev/test fixtures only behind dev/test boundaries;
- do not fabricate reviews, customer photos, personalization, trust labels, or AI
  recommendations;
- optimize media geometry, lazy loading, failure recovery, and low-end scroll behavior.

Critical E2E: Home → shop → product and search → product, with clear back behavior and
an obvious Orders path.

## Sprint 05 — customer COD slice

Preserve the tested one-shop cart, checkout quote, COD placement, order confirmation,
order/session, and tracking behavior.

### Contract gates

- Address list/add/edit/select stays blocked until public HTTP CRUD is approved.
- Cancellation stays blocked until eligibility/action contracts exist.
- Online payment is not part of the COD ticket.

### Requirements

- server inventory, price, fees, discounts, and payable amount are authoritative;
- stock/price changes and serviceability failures are actionable;
- COD placement uses the approved idempotency contract and disables duplicates;
- timeout/unknown/retry copy never claims success without server confirmation;
- success navigation uses the server-returned order ID;
- order status maps to title/copy/semantic state/permitted actions in one tested module;
- live tracking is described truthfully when freshness or capability is limited;
- sensitive address/order data is not logged.

Critical E2E: product → cart → address → quote → COD → confirmation → tracking,
including duplicate submit, failure injection, session expiry, offline handling, and
accessibility.

## Out of scope

- changing search ranking or the order state machine;
- creating address/database behavior from the client;
- payment-provider changes;
- merchant, captain, or admin screens;
- Wardrobe or Group Style behavior.
