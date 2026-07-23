
# Customer orders and tracking

Classification: `READY`.

The customer order list and detail screens consume the existing owned-order contracts. Public status presentation is centralized and intentionally does not expose raw lifecycle labels, actor identities, reason codes, internal notes, pickup secrets, or delivery credentials. Pagination remains cursor-based and deduplicates stable order IDs.

Delivery tracking uses the authenticated customer tracking and delivery-OTP contracts. Server freshness is authoritative. A stale location is labelled clearly; missing tracking is non-blocking; and the delivery OTP is requested only in the public “partner has arrived” state. Customer cancellation, returns, refunds, ratings, and support remain outside this ticket.

## Privacy and lifecycle closure

Tracking and delivery OTP responses are accepted only when their server-owned `orderId` matches the requested order. Component state is scoped to one order, is cleared when the route or lifecycle no longer permits tracking, and is removed after authentication or authorization failure. Delivery OTPs are never shown after their server expiry and are cleared by an expiry timer while the screen remains open.

Order list and detail snapshots remain visible only for recoverable transport or temporary-service failures. Authentication, authorization, not-found, validation, conflict, and malformed-contract failures remove cached customer, address, shop, tracking, and OTP data instead of presenting it as stale.
