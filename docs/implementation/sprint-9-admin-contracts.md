---
sprint: 9
ticket: S9-01
status: implemented
---

# Sprint 9 admin contract freeze

## Purpose

Sprint 9 introduces operational controls without creating a generic database-admin surface. Every mutation is a narrow command, requires server-side permission checks, carries an idempotency key and reason, and writes an immutable audit record.

## Workstreams

| Workstream | Tickets | Ownership |
| --- | --- | --- |
| Admin foundation and dashboard | S9-01, S9-02, S9-03 | permissions, MFA, audit, dashboard, global search |
| Order operations | S9-04, S9-05 | investigation timeline and narrow recovery commands |
| Actor controls | S9-06, S9-07 | merchant and captain operational controls |
| Cases and configuration | S9-08, S9-09 | complaint workflow and versioned operational settings |
| Integration hardening | S9-10 | cross-domain concurrency, security and end-to-end verification |

## Permission model

The canonical permissions live in `apps/backend/src/admin/admin.permissions.ts`. Existing `operations.read` and `operations.manage` permissions remain valid for delivery tooling; new endpoints use domain-specific `admin.*` permissions.

The role matrix deliberately separates read, mutation, trust-and-safety, configuration and audit access. Controllers must continue to use `@AllowAccountTypes('ADMIN')`, `@RequirePermissions(...)`, operational-readiness checks and MFA for sensitive writes.

## Mutation rules

Admin writes must:

1. expose a narrow command endpoint rather than a generic status patch;
2. require an `Idempotency-Key` UUID;
3. require a stable reason code and optionally accept a bounded note;
4. lock and re-read the affected resource inside the database transaction;
5. reject illegal state transitions without partial writes;
6. record actor, action, resource, request ID, idempotency key, reason, before state and after state;
7. avoid putting OTPs, pickup codes, access tokens or other secrets into audit payloads.

## Ticket-sized commit policy

Each Sprint 9 ticket is committed independently using a message prefixed with its ticket ID. Workstream PRs may contain multiple ticket commits, but no commit may mix unrelated tickets.
