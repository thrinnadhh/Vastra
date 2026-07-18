---
sprint: 9
ticket: S9-08
status: implemented
---

# S9-08 complaints and operational incidents

Sprint 9 cases use the existing support ticket and message foundations with explicit order, shop, delivery, merchant and captain associations. Admins can create classified cases, assign owners and teams, append internal notes or evidence, escalate urgent incidents, resolve with stable resolution codes and close only resolved cases. A private append-only history and immutable admin audit record preserve every transition, while idempotency receipts prevent duplicate writes.

Repository CI validates formatting, lint, types, tests, database contracts, OpenAPI and the production build before merge.
