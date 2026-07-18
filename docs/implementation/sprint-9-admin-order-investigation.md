---
sprint: 9
ticket: S9-04
status: implemented
---

# S9-04 order investigation

The order investigation read model returns the authoritative order header, customer operational identity, complete status history, current forward-delivery state, linked support cases and immutable Sprint 9 admin audit records. It is read-only, service-role-only at the database boundary, and guarded by `admin.orders.read` at the HTTP boundary.
