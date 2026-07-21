# Customer root migration

Ticket: `FE-S03-06`

## Root contract

- The authenticated customer root exposes exactly five tabs: Home, Discover, Style, Orders, and Profile.
- Checkout remains a contextual transaction route and is never presented as a sixth tab.
- Selecting another tab clears the contextual transaction route through the typed navigation state.
- Back from Checkout returns to the previously selected root tab.
- The existing checkout quote and authenticated orders implementations remain the route content for Checkout and Orders.

## Access integration

- Home exposes the permission-aware, server-confirmed location flow from `FE-S03-04` without blocking access to preserved transaction surfaces.
- Profile exposes the server-owned account identity, logout, and optional preferences from `FE-S03-05`.
- Discover and Style expose truthful route foundations only; they do not fabricate catalogue, Wardrobe, or Group Style data before their approved sprints.

## Technical decision

The migration consumes the dependency-free typed navigation state from `FE-S03-01`. It does not introduce a navigation package or modify backend, OpenAPI, database, RLS, checkout, or orders contracts.
