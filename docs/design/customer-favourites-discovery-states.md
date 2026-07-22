# FE-S04-05 favourites and discovery states

Status: READY — formatted, guarded, and integrated on FE-S04-04

## Favourite-shop contract

The customer frontend consumes `listCustomerFavouriteShops`, `addCustomerFavouriteShop`, and `removeCustomerFavouriteShop` through a generated-client adapter. Favourite membership is private, account-owned server state. The UI never derives it from follower counts or local card interactions.

## Implemented experience

- a third Discover mode for the authoritative favourite-shop list;
- add/remove favourite action on authoritative shop detail;
- shared favourite IDs across the Shops and Favourites surfaces;
- duplicate-mutation protection per shop;
- empty favourites with a route back to nearby shops;
- current operational status, online-order availability, rating count, and follower facts;
- manual refresh and post-mutation authoritative reconciliation;
- stale-list preservation after a failed refresh;
- partial-failure messaging when a mutation or reconciliation fails;
- private-account wording with no popularity or recommendation claim.

## Discovery-state completion

Sprint 4 discovery now has explicit states for:

- missing or unconfirmed shopping location;
- no serviceable shops around the accepted location;
- empty Home, search, shop catalogue, and favourite inventory;
- initial offline/error reads with retry;
- stale Home, search, product, and favourite data after refresh failure;
- partial shop-detail/catalogue failures;
- unavailable products and variants;
- cart shop conflict and inventory change;
- deleted or no-longer-visible products and shops.

Previously successful data may remain visible only with a stale or partial-failure notice. A mutation failure never changes favourite membership locally. Successful removal can be reflected immediately from the authoritative mutation response, while successful addition is reconciled through the list operation because the mutation response does not contain the complete shop snapshot.

## Verification ownership

Adapter tests cover list/add/remove operation routing, response mapping, and error classification. Component tests cover list facts, empty state, removal, pending protection, stale data, and partial failures. Shop-screen integration exposes add/remove actions using the shared authoritative membership set. FE-S04-06 retains full browser/device journey, accessibility audit, pagination, and low-end image/scroll evidence.
