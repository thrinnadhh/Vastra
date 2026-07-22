# Customer production deep-link ingress

Sprint follow-up: `FE-S03-01`, `FE-S03-02`, `FE-S03-07`

## Native ownership

- The customer Expo application claims only the `vastra` scheme.
- `vastra-merchant` and `vastra-captain` links fail as wrong-application inputs.
- HTTPS, credentials, ports, query strings, fragments, unknown hosts, extra segments, and malformed identifiers fail before navigation.

## Enabled allowlist

- `vastra://product/{productId}` → typed `Discover / ProductDetail`
- `vastra://shop/{shopId}` → typed `Discover / ShopDetail`
- `vastra://order/{orderId}` → typed `Orders / OrderDetail`
- `vastra://look/{lookId}` → typed `Style / LookDetail`

All identifiers must be UUIDs. The parser carries identity only; it never carries price, inventory, order status, authorization, OTP, phone, invite token, or other server-owned state.

## Runtime behavior

- Initial operating-system URLs are consumed after the authenticated customer root mounts, preserving sign-in continuation without persisting the URL.
- The session boundary completes authentication and required profile setup before the production linking port is mounted.
- URLs received while the app is running use the same parser.
- A linked order opens the existing server-authoritative order detail screen; not-found or ownership denial remains intentionally non-enumerating.
- Product, shop, and look routes are placed into canonical typed navigation. Their current `main`-branch placeholders remain truthful until their owning Sprint 4 and Style screens are merged.
- Invalid, reserved, and wrong-application links render a generic recovery surface without reflecting identifiers.
- Back pops the typed linked route and restores its canonical tab.

## Reserved links

Group Style join and room links remain reserved until `BE-FE-011` and Sprint 15. Invite tokens are not accepted or stored by this implementation.

## Evidence boundary

Unit and React Native component tests cover parsing, initial URL ingress, foreground events, wrong-application rejection, safe failure recovery, and typed back behavior. Android/iOS association, cold-start delivery, and physical-device behavior remain release evidence and must be executed on the approved device matrix.
