# FE-S04-01 customer Home composition

Status: READY — implemented on the Sprint 03 root-navigation foundation

## Ownership

The customer `Home` tab remains a Hybrid presentation surface. It consumes the generated
`getCustomerHome` API operation through an injected adapter and does not read Supabase,
database tables, or raw HTTP contracts directly.

## Implemented composition

- explicit shopping-location state and the existing permission/manual-location flow;
- server-confirmed location, serviceable nearby shops, active categories, and nearby
  product cards;
- one restrained editorial hero that communicates broad local-fashion discovery;
- category, nearby-shop, and available-product sections;
- server-backed distance, operational status, preparation time, minimum order, price,
  stock, and variant availability;
- fixed product-media geometry with a truthful missing-image fallback;
- loading, no-service-area, offline, recoverable-error, retry, and stale-data behavior;
- accessible headings, labelled actions, disabled unavailable products, and minimum
  interaction targets;
- preserved access to the contextual Checkout route and the canonical Discover tab.

## Navigation boundary

`FE-S04-01` does not fabricate nested search, category, shop, or product screens. Home
search and card actions hand off to the existing `Discover` tab. `FE-S04-02` through
`FE-S04-04` own the typed nested routes and will replace those handoffs with exact route
parameters.

## Deliberate omissions

The current Home API does not expose campaigns, trends, occasion collections, price-band
collections, reviews, customer photos, personalization, or recommendation claims. Those
sections are not rendered. The information strip uses only factual capabilities already
present in the response and location flow: local shop catalogues, live availability, and
server-checked serviceability.

## State authority

The client never derives serviceability, stock, shop availability, or price from cached
interaction state. A successful response replaces Home content. If a later refresh fails,
previously visible content may remain on screen only with an explicit stale-data warning.
An initial transport failure renders the offline recovery state without invented content.

## Verification ownership

Focused component tests cover Home composition, navigation callbacks, unavailable-variant
protection, service-area emptiness, offline retry, and stale refresh behavior. Adapter tests
cover generated-operation inputs, response mapping, and failure classification. The Home
screen also keeps effect-triggered loading and numeric accessibility copy compatible with
the repository's strict React and TypeScript lint rules. `FE-S04-06` retains ownership of
device/browser discovery E2E, pagination, accessibility, and low-end media/scroll evidence.
