# Supabase and Database Instructions

These rules extend the repository `AGENTS.md`.

## Migrations

- Every schema change is a new ordered migration.
- Never edit a migration already applied to staging or production.
- Never make manual production schema changes.
- Include comments for non-obvious constraints/functions.
- Test from a clean local database.
- Test upgrades from the previous migration state.
- Document rollback or forward-fix strategy.

## Auth

Use Supabase `auth.users`.

Application identity lives in `public.profiles` with role-specific profile tables.

## RLS

- Enable RLS on every exposed table.
- Deny by default.
- Add indexes for policy predicates.
- Test policies as customer, merchant, captain, admin, and anonymous user.
- Do not use service role in client-side tests to “make it work.”

## Critical functions

Critical mutations may use secure database functions or backend transactions.

Functions must:

- Validate actor
- Validate state
- Lock rows when needed
- Reject negative inventory
- Write immutable history
- Be idempotent when applicable

## Storage

Private:

- Merchant documents
- Captain documents
- Return evidence
- Support attachments
- Future body/try-on media

Use signed URLs. Test unauthorized access and expiry.

## Database tests

Required:

- Last-unit concurrency
- Inventory non-negativity
- Reservation release
- Order state transitions
- Assignment exclusivity
- Webhook event uniqueness
- RLS isolation
- Audit immutability
