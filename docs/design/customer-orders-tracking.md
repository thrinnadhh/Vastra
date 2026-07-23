
# Customer orders and tracking

Classification: `READY`.

The customer order list and detail screens consume the existing owned-order contracts. Public status presentation is centralized and intentionally does not expose raw lifecycle labels, actor identities, reason codes, internal notes, pickup secrets, or delivery credentials. Pagination remains cursor-based and deduplicates stable order IDs.

Delivery tracking uses the authenticated customer tracking and delivery-OTP contracts. Server freshness is authoritative. A stale location is labelled clearly; missing tracking is non-blocking; and the delivery OTP is requested only in the public “partner has arrived” state. Customer cancellation, returns, refunds, ratings, and support remain outside this ticket.
