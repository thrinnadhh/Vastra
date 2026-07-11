Plan and implement the Supabase foundation in small migrations.

Read:

- docs/architecture/database-schema.md
- docs/architecture/security-model.md
- docs/product/business-rules.md
- docs/workflows/order-state-machine.md
- supabase/AGENTS.md

Required ticket groups:

1. Extensions and shared types
2. Profiles and role tables
3. Shops and addresses
4. Catalogue and variants
5. Inventory balances, movements, and reservations
6. Orders and histories
7. Delivery tasks and assignments
8. Payments, returns, support, audit, and outbox
9. RLS policies
10. Indexes
11. Seed fixtures
12. Database and RLS tests

Rules:

- Use auth.users.
- Every exposed table has RLS.
- Add ownership and role tests.
- Add concurrency tests for last-unit inventory and captain assignment.
- Never use production credentials.
- Never squash or rewrite released migrations.

Return the ticket plan first. Implement only the first approved ticket.
