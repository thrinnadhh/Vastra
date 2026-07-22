
# Customer cart

## Ticket audit

- **Ticket:** `FE-S05-01`
- **Classification:** `READY`
- **Boundary:** authenticated customer cart read and mutation UI only. Application-root and navigation wiring remain owned by `FE-S05-04`.
- **Existing behavior preserved:** product-detail add-to-cart continues to use `setCustomerCartItem`; this ticket does not alter discovery or product detail.
- **API operations:** `getCustomerCart`, `setCustomerCartItem`, `updateCustomerCartItem`, `removeCustomerCartItem`, and `clearCustomerCart` through `@vastra/api-client`.
- **Contract gaps:** none for the assigned cart behavior. Coupon and final checkout orchestration are outside this ticket.
- **Platform gap closed:** reusable cart adapter, screen, conflict prompt, and focused tests.
- **Shared-file conflicts:** none. No root, navigation, checkout, orders, backend, migration, or OpenAPI files are changed.

## Authority and recovery

The backend owns shop identity, live availability, current prices, subtotal, and one-shop enforcement. Quantity writes use desired final values, which makes duplicate retries safe. The screen blocks concurrent mutations and refreshes after price, inventory, unavailable-line, and missing-line conflicts.

A `CART_SHOP_CONFLICT` never clears the cart automatically. The exported `CustomerCartReplacementPrompt` gives the later integration owner an explicit confirmation boundary. The confirmed request must repeat `setCustomerCartItem` with `replaceExistingCart: true`.

## Integration port

`CustomerCartScreen` requires a `CustomerCartPort` and exposes `onCheckout`. `FE-S05-04` owns route registration and Product → Cart → Address → Quote → COD orchestration.

## States and accessibility

The screen covers loading, empty, recoverable error, offline/stale data, session expiry, unavailable items, price changes, direct quantity entry, removal, clear confirmation, and duplicate submission. Controls expose labels and disabled state, while authoritative changes are announced through live regions.
