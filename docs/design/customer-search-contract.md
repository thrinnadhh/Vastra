# FE-S04-02 customer search contract

Status: READY — formatted and stacked on FE-S04-01

## Contract boundary

Customer search calls the generated `searchCustomerProducts` operation through an injected
adapter. The screen does not issue raw HTTP requests, query Supabase, decode cursors, or
invent product, shop, distance, price, stock, or availability data.

The backend contract requires a normalized search term of 2–100 characters and confirmed
latitude/longitude. Optional filters are category, gender, shop, minimum price, maximum
price, availability, and sort. Sort is limited to `RELEVANCE`, `DISTANCE`, `PRICE_ASC`, and
`PRICE_DESC`. Pages use the opaque server cursor and a limit of 20.

## Implemented experience

- location-gated search shared with the Home tab;
- normalized query submission and validation;
- session-local suggestions from successful recent searches only;
- gender, price-band, availability, category-bound, shop-bound, and sort state;
- automatic authoritative refresh after changing a filter on a submitted query;
- server-ordered cursor pagination with product-ID deduplication;
- fixed product-card media geometry and truthful unavailable-product handling;
- no-results recovery by clearing filters or editing the preserved query;
- initial offline/error recovery and stale-result preservation after refresh failure;
- parent-owned search state so query, filters, results, next cursor, and suggestions survive
  root-tab switches;
- a truthful FE-S04-04 handoff boundary instead of fabricated product-detail data.

## Suggestions

There is no server suggestion endpoint in the current API coverage. FE-S04-02 therefore
uses only successful queries from the current in-memory session as suggestions. They are
not persisted, logged, represented as popularity, or presented as catalogue facts.

## State authority

The client may preserve form and previously successful page state. A new successful first
page replaces prior results. A cursor page appends in server order and deduplicates by
stable product ID. A failed refresh may keep prior results visible only with an explicit
stale banner. Cursor values remain opaque and are never decoded by the frontend.

## Verification ownership

Adapter tests cover request serialization, null-filter omission, opaque cursor forwarding,
response mapping, and offline/error classification. Component tests cover location gating,
query validation, successful search, session suggestions, filter refresh, cursor append,
deduplication, no-results recovery, product handoff, and stale-result preservation. Test
assertions use fully typed request objects rather than unsafe partial matcher assignments.
`FE-S04-06` retains device/browser discovery E2E, accessibility audit, performance evidence,
and long-list/low-end verification.
