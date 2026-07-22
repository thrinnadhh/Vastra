# FE-S04-04 customer product detail

Status: READY — formatted, exhaustively typed, and fixture-verified on FE-S04-03

## Contract boundary

The product screen consumes `getCustomerCatalogueProduct` and `setCustomerCartItem` through one injected generated-client adapter. Product media, variants, selling price, MRP, available quantity, shop identity, return eligibility, and care facts remain server-authoritative.

The frontend does not query Supabase, issue raw HTTP, infer stock, fabricate variants, or silently replace a cart from another shop.

## Implemented experience

- ordered product gallery with primary-image selection and a truthful missing-media fallback;
- brand, description, material, style, occasion, care, shop, and return information;
- real size/colour variant controls with unavailable options disabled;
- selling price, MRP, live stock quantity, and quantity limits from the selected variant;
- manual and post-cart authoritative price/stock refresh;
- stale-data warning when a refresh fails after a successful read;
- add-to-cart using the selected variant and quantity;
- explicit one-shop-cart replacement confirmation for `CART_SHOP_CONFLICT`;
- inventory-change, product-not-found, offline, retry, and disabled-ordering states;
- preserved back navigation to the originating discovery surface.

## Size-chart boundary

The current contract exposes merchant-defined `sizeLabel` values but no measurement schema, size-chart entity, or size-chart operation. The UI shows the real labels and an explicit contract notice instead of inventing body measurements. The reserved `SizeChart` route remains a contract gap until `BE-FE-003` closes it.

## Cart authority

The initial cart write always sends `replaceExistingCart: false`. When the backend returns `CART_SHOP_CONFLICT`, the user must explicitly choose **Replace cart and add** before the frontend retries with `replaceExistingCart: true`. Inventory and variant failures never become local success. A successful cart write is followed by a product refresh so displayed price and stock are revalidated.

## Verification ownership

Adapter tests cover operation names, path/body serialization, ordered media mapping, cart result mapping, and error classification. Component tests cover product facts, variant selection, quantity limits, add-to-cart, explicit cart replacement, unavailable variants, post-add refresh, and stale refresh recovery. FE-S04-06 retains full device/browser journey, accessibility, and low-end media/scroll evidence.
