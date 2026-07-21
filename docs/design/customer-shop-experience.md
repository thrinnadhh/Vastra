# FE-S04-03 customer shop experience

Status: READY — stacked on FE-S04-02

## Contract boundary

The shop experience consumes three generated operations through one injected adapter:

- `listCustomerNearbyShops` for the serviceable directory;
- `getCustomerShopDetail` for authoritative ordering state, serviceability, hours, and shop
  facts;
- `listCustomerShopProducts` for the opaque-cursor catalogue.

The frontend does not derive serviceability, open/closed state, orderability, distance,
price, stock, rating, or follower counts. It does not query Supabase or issue raw HTTP.

## Implemented experience

- a persistent Products/Shops mode switch inside the canonical Discover tab;
- confirmed-location gating and the existing permission/manual-location recovery flow;
- nearby shop cards with server distance, online-order status, preparation time, minimum
  order, and ratings;
- authoritative shop detail with ordering status, today's Asia/Kolkata hours,
  serviceability, distance, preparation estimate, minimum order, contact facts, rating,
  followers, and service radius;
- cursor-paginated shop catalogue with fixed media geometry, live price/stock indicators,
  stable product-ID deduplication, and disabled unavailable products;
- loading, offline/error retry, empty service area, empty catalogue, and pagination states;
- preserved product handoff to the truthful FE-S04-04 boundary.

## Delivery estimate boundary

The current shop-detail contract exposes average preparation minutes but no customer
last-mile ETA. The UI labels this field **Preparation estimate** and does not present it as a
delivery estimate. A delivery ETA must remain absent until an authoritative contract is
available.

## State authority

Opening a shop requests detail and the first catalogue page together. Both must succeed
before the full shop experience is shown. Catalogue cursors remain opaque. Additional
pages append in server order and deduplicate by product ID. A failed page request is
recoverable and never manufactures products.

## Verification ownership

Adapter tests cover all three generated operations, path/query serialization, opaque cursor
forwarding, mapping, and offline classification. Component tests cover location gating,
nearby directory rendering, shop-detail loading, catalogue rendering, product handoff,
opaque-cursor pagination, deduplication, unavailable-product protection, and empty-area
recovery. `FE-S04-06` retains device/browser discovery E2E, accessibility audit,
performance evidence, and long-list/low-end verification.
