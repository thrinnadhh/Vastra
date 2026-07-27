# Post-merge production-readiness audit

---
audit_date: 2026-07-27
target_branch: fix/ci-supabase-db-only
audited_merge_commit: a83fbdc37df255ec914ce68e726b3d10e99ace9b
remediation_code_commit: d33ab2eab7ca86b72f91635f0532d871626105d5
verification_run: 30249692925
code_readiness: ready-with-explicit-conditions
deployment_readiness: not-ready
operational_pilot_readiness: not-ready
---

## Audited commit and merge integrity

- Audited merge commit: `a83fbdc37df255ec914ce68e726b3d10e99ace9b`
- First parent: `b53027f7c1a0a909016e9f62bc8a71be46cf922b`
- Second parent: `80a03a9ce6d1dd367afd6db83781872a6595169a`
- Remediation code commit: `d33ab2eab7ca86b72f91635f0532d871626105d5`
- Target branch: `fix/ci-supabase-db-only`
- GitHub comparison: branch is ahead of `main` and not behind it.

GitHub code search found no `<<<<<<<` or `>>>>>>>` conflict markers. The execution
environment did not contain `/Users/trinadh/projects/vastra`, so local index and
working-tree checks could not be run. In particular, this audit does **not** claim
results for `git status --short`, `git diff --check`, `git ls-files -u`,
`git diff --cached`, or local staged-secret/build-output inspection. Those checks
remain mandatory in a normal checkout before merge.

## Scope

The audit covers the merged NestJS backend, Supabase migrations and pgTAP tests,
OpenAPI/generated-client parity, current customer/merchant/captain/admin integrations,
CI, security boundaries, payment/refund processing, database authorization, runtime
shutdown behavior, and available pilot evidence.

No excluded AI sizing, body scanning, virtual try-on, multi-shop cart, or multiple
merchant staff functionality was introduced by the remediation. A scope-authority
conflict remains: `docs/product/mvp-scope.md`, `docs/product/business-rules.md`,
`docs/architecture/security-model.md`, and `docs/testing/acceptance-tests.md` include
private Group Style, while the production-readiness mission and customer-app repository
rules exclude Group Style. This audit does not add or remove that feature. Product
ownership must align the canonical documents before production approval.

## Architecture summary

- Backend: NestJS TypeScript modular monolith with controllers, domain services,
  Supabase gateways/repositories, global authentication/account/permission/MFA guards,
  request IDs, runtime limits, health endpoints, and bounded background workers.
- Database: Supabase PostgreSQL with RLS, privileged service-role RPCs, transactional
  order/inventory/payment commands, immutable history/audit records, idempotency
  receipts, row locking, and durable outbox records.
- Clients: customer, merchant, captain, and admin applications consume the shared
  generated API client for implemented backend integrations.
- External dependencies: Supabase Auth/Storage/Realtime, Cashfree, SMS/OTP, FCM,
  mapping, monitoring, backups, and production secret stores require environment-specific
  evidence and are not proven by repository CI.

## Verification matrix

| Command or gate | Result | Evidence / limitation |
|---|---|---|
| `pnpm install --frozen-lockfile` | PASS | Executed independently in each CI lane. |
| `pnpm format:check` | PASS | Exact-head static-quality lane. |
| `pnpm env:check` | PASS | Exact-head static-quality lane. |
| `pnpm test:pilot-tooling` | PASS | Validates evidence/report tooling; does not execute a real pilot. |
| `pnpm pilot:evidence:check` | PASS | Evidence structure only; does not constitute GO evidence. |
| `pnpm security:client-secrets` | PASS | Source/config scan. Generated `.next` output is excluded, so a production bundle scan remains required. |
| `pnpm lint` | PASS | Generates 172 OpenAPI operations, then ESLint passes with zero allowed warnings. |
| `pnpm typecheck` | PASS | Exact-head static-quality lane after correcting the refund-worker test double. |
| `pnpm test` | PASS | Exact-head application-test lane. |
| `pnpm test:integration` | PASS | Exact-head application-test lane. |
| `pnpm db:test` | PASS | Clean Supabase database test lane, including the new inactive-admin pgTAP regression. |
| `pnpm openapi:check` | PASS | Redocly validation in database/contracts lane. |
| `pnpm --filter @vastra/api-client contract:check` | PASS | Zero reported runtime/OpenAPI parity failures in the successful contract lane. |
| `pnpm --filter @vastra/api-client build` | PASS | Covered by root test/frontend harness. |
| `pnpm --filter @vastra/api-client typecheck` | PASS | Covered by root typecheck. |
| `pnpm --filter @vastra/api-client test` | PASS | Covered by root unit-test gate. |
| `pnpm build` | PASS | Exact-head workspace-build lane. |
| `pnpm test:frontend:e2e` / visual | PASS | Covered by `pnpm test:frontend:harness` in the frontend lane. |
| `git diff --check` | NOT RUN | No local checkout was mounted. |
| `git ls-files -u` | NOT RUN | No local index was mounted. |
| Full staged secret/build-output review | NOT RUN | Requires the named local workspace. |

## Security findings

### P1 fixed — inactive administrator retained database elevation

The previous `authz.is_admin()` authorization path could accept an AAL2 identity with
an administrator record without requiring the corresponding profile to remain ACTIVE.
Because the predicate is used by administrator RLS and permission checks, a suspended,
blocked, or deleted administrator could retain cross-tenant database authority through
an existing token.

Migration `20260727090000_admin_status_authorization_hardening.sql` now requires an
ACTIVE profile for both administrator identity paths. The function remains
`SECURITY DEFINER`, uses an empty `search_path`, fully qualifies relations, revokes
public execution, and grants execution only to `authenticated` and `service_role`.
`0096_admin_status_authorization.test.sql` proves an active AAL2 administrator receives
the expected RLS access and loses administrator elevation, blanket permission, and
cross-user reads immediately after suspension.

### Client and API boundaries

- Service-role/payment/SMS/FCM/database secrets are forbidden in client source/config.
- Backend authorization remains server-side; frontend control visibility is not treated
  as permission.
- Admin AAL2/MFA, account-state, account-type, fine-grained permission, ownership, and
  business-state checks remain required for protected operations.
- Payment success remains provider/webhook authoritative, not client authoritative.
- The current secret scanner intentionally excludes generated `.next` files. This avoids
  dependency/build-output false positives but means production bundle inspection must be
  performed separately before deployment.

### Unresolved security hardening

- Several older service-role-only `SECURITY DEFINER` functions still use broader
  `public` or `public, private` search paths instead of fully qualified objects with an
  empty path. No direct client execution was proven, but consolidation remains a P2 item.
- Multiple permissive RLS policy advisor warnings require consolidation and query-plan
  review before scale testing, even though current pgTAP isolation tests pass.

## Database findings

- The new authorization migration is forward-only; no released migration was deleted or
  rewritten.
- The migration uses an empty search path, qualified relations, explicit revocation, and
  restricted grants.
- Database CI rebuild and pgTAP passed on the verified remediation code.
- Existing transaction evidence covers row-locked variant reservation, exactly-once
  release paths, immutable movements/history, idempotent commands, delivery assignment,
  COD/earnings, payment webhook replay, refunds, and administrator approval/recovery.
- Production/staging migration timing, lock impact, backup/restore, rollback-forward
  recovery, and real data query plans remain unverified.

## API parity result

The generated client currently contains 172 OpenAPI operations. OpenAPI lint and the
controller/generated-client contract check pass in CI. No route mismatch or duplicate
runtime-route failure was reported. Request/response contract changes were not introduced
by the remediation.

## Core transaction evidence

Repository tests cover the frozen COD path from order placement and atomic reservation
through merchant alert/accept/packing, exclusive captain assignment, pickup code,
delivery OTP, exact COD recording, and exactly-once earnings/history effects. Additional
tests cover cancellation/rejection release, webhook signature/replay behavior,
administrator approvals, audit, and selected recovery commands.

This is code-level evidence only. A staging order using real Supabase migrations,
Cashfree sandbox/live-mode configuration as applicable, SMS/OTP, FCM devices, and
operational dashboards has not been evidenced for this release commit.

## Frontend integration status

- Generated API client creation, type checking, tests, and workspace compilation are
  covered by repository gates.
- Current frontend harness passes customer/merchant/captain/admin E2E and visual tests.
- Admin approval and operational surfaces are present in the merged baseline.
- Real session expiry, MFA enrollment/recovery, push delivery on physical devices,
  production responsive layouts, accessibility assistive-technology checks, and provider
  failure UX require staging/device evidence.

## Fixed findings

1. **P1:** inactive administrator database/RLS elevation removed, with pgTAP regression.
2. **P2:** automatic refund worker coalesces concurrent drains, blocks new work during
   shutdown, clears its timer, and awaits the in-flight financial drain.
3. **P2:** refund-worker regression test lint and service-stub type signature corrected.
4. **P2:** CI preserves lint, typecheck, unit-test, and build diagnostics as artifacts.
5. **P3:** client secret source scanner excludes generated `.next` output and has tooling
   coverage; production bundle scanning remains a deployment condition.

## Unresolved findings and blockers

1. Local merge/index/staging checks have not been executed in the specified workspace.
2. Canonical Group Style scope conflicts with the explicit production-readiness mission.
3. Production secrets and environment configuration have not been provisioned or checked.
4. Staging migrations and a complete order-to-delivery smoke test have no release-bound evidence.
5. Cashfree webhook/refund, SMS/OTP, realtime, and physical FCM behavior are not externally verified.
6. Monitoring, alert routing, failed-notification visibility, on-call ownership, recovery
   drills, backup/restore, and query-plan/load evidence are incomplete.
7. Broad legacy `SECURITY DEFINER` search paths and RLS policy consolidation remain P2 work.
8. Product, engineering, and operations pilot sign-offs are absent.

## Required environment and infrastructure checks

- Run staging migrations from a clean baseline and from the current production-equivalent
  schema; capture duration, locks, checksums, and roll-forward recovery evidence.
- Execute one COD and one online-payment order end-to-end with real provider callbacks,
  OTP, FCM, merchant ringing, captain assignment, delivery completion, settlement, and audit.
- Verify production environment parsing fails closed and inject secrets only through the
  approved vault/runtime configuration.
- Scan built web/mobile bundles for privileged identifiers and secret-value patterns.
- Run pilot load/query-plan checks on representative data and resolve advisor warnings.
- Exercise refund retry/reconciliation, notification failure recovery, admin recovery,
  backup/restore, and incident alerting runbooks.
- Obtain product, engineering, and operations sign-off against the same release commit.

## Final three-part readiness verdict

### 1. Code readiness — READY WITH EXPLICIT CONDITIONS

The exact remediation code commit passed formatting, environment validation, source
secret scanning, lint, typecheck, unit tests, integration tests, database tests,
OpenAPI validation, generated-client contract parity, workspace build, frontend E2E,
and visual verification in CI run `30249692925`. The remaining code-readiness
conditions are the local merge/index/diff/staged-artifact checks in the named workspace,
canonical Group Style scope alignment, and a final green CI run after this report-only
commit.

### 2. Deployment readiness — NOT READY

Production/staging configuration, migrations, bundle-secret inspection, provider
callbacks, deployment smoke tests, monitoring, and recovery evidence are not complete.

### 3. Operational/pilot readiness — NOT READY

The controlled pilot lacks release-bound device/provider/load/recovery evidence and the
required product, engineering, and operations sign-offs.
