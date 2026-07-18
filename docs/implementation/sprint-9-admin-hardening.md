---
sprint: 9
ticket: S9-10
status: implemented
---

# S9-10 admin integration hardening and closure

## Closure result

Sprint 9 is complete when this ticket's normal repository CI passes and its PR is merged. The hardening layer verifies the complete S9-01 through S9-09 surface as one integrated system rather than as isolated workstream branches.

## Security regression matrix

- Every admin controller is registered exactly once.
- Every admin route is restricted to `ADMIN` accounts.
- Every admin route has an explicit canonical read or manage permission.
- AAL1 and legacy administrator sessions fail closed before authorization.
- Non-admin accounts cannot reach admin handlers even when a client advertises an admin permission.
- Read-only operators cannot invoke mutations.
- AAL2 administrators with the exact permission can reach the intended narrow command.
- Administrator operational-readiness checks do not incorrectly query merchant or captain profiles.

## Database hardening

- Every Sprint 9 RPC is `SECURITY DEFINER`, pins `search_path`, is executable by `service_role`, and is denied to `anon` and `authenticated`.
- Every mutation structurally claims an idempotency receipt and records audit state.
- `private.admin_audit_log`, case history and configuration history are append-only.
- Audit records are unique per actor, action and idempotency key.
- Command receipts reference their immutable audit record and require a SHA-256 request fingerprint.
- Audit storage has no dedicated OTP, token, password, secret or code-hash columns.

## Merge gate

The final PR must pass formatting, environment validation, lint, typecheck, unit tests, integration tests, the complete Supabase migration and pgTAP suite, OpenAPI validation and the production build.
