# FE-S04-06 discovery E2E evidence

Status: READY — automated repository evidence implemented; clean final verification active

## Journeys covered

The customer-app integration suite composes the production Home, nearby-shop, search, and product-detail screens with deterministic implementations of their typed ports.

### Home → shop → product

The journey proves:

1. Home loads a server-shaped serviceable location, nearby shop, category, and available product.
2. The accessible Home shop action preserves the exact `shopId` instead of opening a generic placeholder.
3. Discover consumes the typed shop intent and requests authoritative shop detail plus the first catalogue page.
4. The shop screen renders ordering state, Asia/Kolkata hours, preparation time, minimum order, catalogue, and accessibility labels.
5. Selecting the available catalogue product preserves its exact `productId`.
6. Product detail loads the real variant, stock, price, shop, and return contract.
7. Add-to-cart sends the selected variant and quantity and refreshes product state after success.

### Search → product

The journey proves:

1. A normalized query is submitted with confirmed coordinates and a bounded page size.
2. The opaque cursor from page one is passed unchanged to page two.
3. Duplicate product IDs across pages are removed while server ordering is preserved.
4. The result count and end state update after pagination.
5. The selected result opens product detail through the exact `productId`.

## Accessibility evidence

Automated assertions use semantic roles, accessible names, disabled/selected states, live-region status copy, and stable test IDs only where semantic queries are insufficient. Covered controls include Home shop/product actions, search submission and pagination, shop catalogue products, variant selection, quantity controls, add-to-cart, refresh, retry, and back navigation.

The ticket does not claim a complete WCAG audit from unit tests alone. The repository Playwright shell/visual harness still executes in CI, and release-level assistive-technology/device evidence remains separately owned.

## Pagination and low-end performance contract

Discovery requests are intentionally bounded:

- search page: 20 products;
- shop catalogue page: 20 products;
- nearby directory: 50 shops;
- in-memory recent search suggestions: 5 entries.

The product hero uses fixed 360-point geometry. Product/search/shop media cards retain fixed geometry and truthful fallbacks, preventing layout jumps when images are absent or slow. Long discovery surfaces use clipped scroll rendering where supported. Pagination appends only stable-ID-unique items and does not decode or expand opaque cursors on the client.

These constraints are executable constants covered by `customer-discovery-performance.test.ts`; journey tests additionally assert the actual page limits sent to typed ports.

## Browser and device boundary

CI runs the existing pinned Chromium frontend E2E/visual harness alongside the customer Jest integration suite. This ticket does not claim physical Android/iOS, low-memory hardware, screen-reader, or multi-browser passage without captured evidence from those environments. The implementation and automated evidence are structured so release evidence can run the same journeys without changing product contracts.

## Ownership and non-regression

No backend controller, OpenAPI operation, database migration, RLS policy, dependency, lockfile, checkout, order, or actor-scope behavior is changed. All discovery facts remain generated-client/server-authoritative. Reviews, customer photos, personalization, delivery ETA, and measurement-based size charts remain absent where no contract exists.
