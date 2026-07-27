---
audit_date: 2026-07-26
scope: backend-and-current-frontend
code_status: release-candidate
pilot_decision: NO_GO
---

# Production readiness audit

## Outcome

The implemented backend and current frontend surfaces pass the repository's automated
quality gates and are suitable for a release candidate. The Vastra product is not yet
approved for production traffic.

The authoritative pilot manifest remains `NOT_ASSESSED`, every Sprint 11 execution gate
remains `NOT_RUN`, and no product, engineering, or operations owner has signed off.
Under the frozen go/no-go rules, unexecuted critical gates require `NO_GO`.

## Stabilization completed

- Restored the customer authentication, account-status, account-type, and operational
  readiness guard chain.
- Aligned runtime controllers and the generated client with the OpenAPI contract. The
  parity gate covers 169 non-excluded operations.
- Added transactional, idempotent customer cancellation, including reservation release,
  immutable history, alert termination, and captured-payment refund creation.
- Added merchant and captain account-approval commands with MFA, permission, audit, and
  database transaction enforcement.
- Added admin live-order and merchant dashboard read models.
- Replaced the admin foundation page with a secure, AAL2-gated operations dashboard
  backed by the generated API client, including summary metrics, filters, live-order
  pagination, and complete loading/error/empty/access-denied states.
- Rejected stale or future payment webhook timestamps and bounded Cashfree network calls.
- Added automatic, bounded execution of initiated cancellation refunds while preserving
  the initiating actor and provider idempotency identity.
- Split liveness (`/health`) from database-backed readiness (`/health/ready`).
- Hardened the HTTP runtime with strict production CORS, request IDs, secure headers,
  body limits, JSON content-type enforcement, rate limiting, proxy validation, raw-body
  preservation, and graceful shutdown hooks.
- Made visual baselines deterministic on Linux CI and macOS development hosts.
- Made OpenAPI generation emit Prettier-compliant output so a build does not invalidate
  the format gate.

## Automated evidence observed

| Gate | Result |
|---|---|
| Lint | PASS |
| TypeScript typecheck | PASS — 16 packages |
| Unit/component tests | PASS — all 16 packages |
| Backend integration | PASS — 48 files, 179 tests |
| Database clean rebuild and pgTAP | PASS — 75 files, 1,556 assertions |
| Database concurrency scenarios | PASS — inventory, COD, assignment, and outbox claims |
| OpenAPI validation and controller parity | PASS — 169 operations |
| Frontend functional E2E | PASS — 31 journeys |
| Frontend visual regression | PASS — 9 baselines |
| Workspace production build | PASS — 16 packages |
| Environment contract validation | PASS |
| Client-secret scan | PASS |
| Pilot evidence schema/tooling | PASS |
| Repository formatting | PASS |

The database advisor reported multiple-permissive-policy warnings on some `SELECT`
paths. These are query-planning/performance warnings rather than evidence of an RLS
bypass; consolidate them before scale testing where practical.

## Current frontend boundary

The customer COD journey, customer navigation/discovery/order foundations, merchant
fulfilment path, captain COD delivery path, shared frontend infrastructure, and the
admin read-only operations dashboard have automated coverage. The admin application
now provides secure sign-in, AAL2 enforcement, aggregate operational metrics, filters,
and a paginated live-order queue.

The complete frozen screen inventory is not implemented end to end. Material remaining
surfaces include admin order investigation/recovery actions, account approvals,
support/finance/audit/configuration tools, full customer online-payment/return/support
experiences, merchant catalogue/inventory/finance/support self-service, and captain
onboarding/earnings/history/support. These are product-completeness blockers even
though the supporting backend is substantially broader than the current clients.

The repository does not contain release-environment credentials, so the real Supabase
password-plus-TOTP flow remains a production evidence gate even though its fail-closed
client orchestration and entry surface have automated coverage.

There is also an unresolved scope conflict: `docs/product/mvp-scope.md` includes Group
Style, while `apps/customer-app/AGENTS.md` explicitly forbids implementing it. Group
Style remains excluded from the generated MVP client until product ownership resolves
the canonical boundary.

## Production gates still required

- Run the full acceptance and actor-isolation suites in the release environment and
  attach evidence to the pilot manifest.
- Run an authorized dependency vulnerability audit. It was not executed during this
  audit because registry disclosure required explicit external-network authorization.
- Validate migrations on a staging copy and complete load/concurrency testing there.
- Verify merchant foreground/background/killed-app ringing on physical Android devices.
- Rehearse real provider payment, webhook, refund, and COD failure/recovery scenarios.
- Verify backup restore, deployment promotion, rollback/forward-fix, dashboards, and
  operational alert routing.
- Configure production credentials and supported origins in the approved secret store.
- Complete the missing frontend surfaces or formally reduce the frozen pilot scope.
- Record the release commit, attach evidence, close critical/high defects, and collect
  product, engineering, and operations sign-off.

## Decision

Automated code readiness: **PASS**.

Production/pilot readiness: **NO_GO** until the critical external gates, frontend
completeness decisions, scope conflict, and owner sign-offs above are resolved.
