---
audit_date: 2026-07-27
scope: backend-and-current-frontend
baseline_commit: a83fbdc37df255ec914ce68e726b3d10e99ace9b
remediation_commit: ad120461e8e3f63135bde7d747068f5e43986ca9
code_readiness: pending-branch-verification
deployment_readiness: not-ready
operational_pilot_readiness: not-ready
---

# Post-merge production-readiness audit

## Audited commit and merge integrity

- Audited merge commit: `a83fbdc37df255ec914ce68e726b3d10e99ace9b`
- First parent (`main` before merge): `b53027f7c1a0a909016e9f62bc8a71be46cf922b`
- Second parent (merged branch head): `80a03a9ce6d1dd367afd6db83781872a6595169a`
- Target branch: `fix/ci-supabase-db-only`
- Remediation code head before this report: `ad120461e8e3f63135bde7d747068f5e43986ca9`

The target ref was one commit behind `main` after pull request 149 merged. It was
fast-forwarded to the merge commit without rewriting history before remediation
commits were added. GitHub comparison reports the branch is ahead of `main` and not
behind it. Repository code search found no `<<<<<<<` or `>>>>>>>` conflict markers.

A local checkout was not mounted in the execution environment. Consequently,
`git status --short`, `git diff --check`, `git ls-files -u`, index/staging inspection,
and local secret/build-output staging inspection could not be executed. Those checks
remain required in a normal checkout before merge.

## Scope

The audit covers the merged TypeScript backend, Supabase migrations and pgTAP tests,
generated API client and OpenAPI parity, current customer/merchant/captain/admin
integrations, CI, security boundaries, payment/refund behavior, health/runtime
hardening, and available pilot evidence.

No excluded feature was added. The audit found an unresolved authority conflict:
`docs/product/mvp-scope.md`, business rules, security model, OpenAPI, and acceptance
tests include private Group Style functionality, while the production-readiness
mission and customer-app repository instructions exclude it. This audit does not
expand or remove Group Style. Product ownership must resolve and align the canonical
scope before production approval.

## Architecture summary

- Backend: NestJS TypeScript modular monolith with thin controllers, domain services,
  Supabase gateways/repositories, global authentication/account-type/permission/MFA
  guards, structured HTTP runtime controls, health/readiness endpoints, and bounded
  background workers.
- Database: Supabase PostgreSQL with forward-only migrations, forced RLS on exposed
  tables, service-role-only privileged RPCs, transactional state-machine functions,
  immutable history/audit tables, inventory row locking, idempotency receipts, and
  durable outbox events.
- Clients: customer, merchant, captain, and admin applications use the shared/generated
  API client for implemented server integrations. Current automated coverage includes
  the COD customer-to-delivery path and admin operational surfaces, but not the full
  frozen product screen inventory.
- External systems: Supabase Auth/Storage/Realtime, FCM, Cashfree payment/refund APIs,
  SMS/OTP, maps, and operational monitoring require environment-specific evidence.

## Findings by severity

### P1 fixed — inactive administrator retained RLS elevation

`authz.is_admin()` required AAL2 but accepted any matching `admin_profiles` row even
when `public.profiles.status` was `SUSPENDED`, `BLOCKED`, or `DELETED`. Because the
predicate backs blanket administrator read policies and `authz.has_permission()`, an
existing AAL2 token could retain cross-tenant database read authority after account
suspension.

The forward-only migration `20260727090000_admin_status_authorization_hardening.sql`
now requires one active profile before either administrator identity path can elevate.
The function retains an empty `search_path`, default execute is revoked, and only
`authenticated` and `service_role` receive execute privilege. pgTAP regression test
`0096_admin_status_authorization.test.sql` proves that an active AAL2 administrator can
use admin RLS access, then loses `authz.is_admin()`, blanket permissions, and cross-user
RLS reads immediately after suspension.

### P2 fixed — refund worker did not drain during shutdown

`RefundExecutionWorker.onApplicationShutdown()` cleared future polling but returned
without awaiting an in-flight provider/refund command. A deployment shutdown could
interrupt financial processing between provider interaction and durable reconciliation.

The worker now coalesces concurrent drains, blocks queued/new drains after shutdown
starts, clears the interval, and awaits the active drain. The regression test holds a
refund drain open, verifies shutdown remains pending, completes the command, and proves
no new drain starts afterward. Provider idempotency and database replay handling remain
unchanged.

### P2 unresolved — broad SECURITY DEFINER search paths

Several older service-role-only administrator read/control functions pin `search_path`
to `public` or `public, private` rather than the repository's preferred empty path.
Direct client execute grants are revoked and the functions are covered by service-role
contract tests, so no direct exploit was proven in this audit. Consolidating these
functions onto fully qualified references and empty paths remains recommended before
scale or privilege-boundary expansion.

### P2 unresolved — RLS policy consolidation warnings

The database advisor previously reported multiple permissive `SELECT` policies on some
paths. Existing pgTAP isolation tests and CI did not show a bypass, but policy
consolidation and query-plan review remain required before load testing.

## Security review

### Authentication and authorization

- Backend JWT/auth context, active-account, account-type, permission, and operational
  readiness guards are present for protected HTTP routes.
- Admin HTTP requests require AAL2 unless a route is explicitly limited to the MFA
  bootstrap flow.
- Admin approval endpoints require administrator account type, operational readiness,
  fine-grained manage permission, idempotency key, validated UUIDs, and validated reason
  payloads.
- Merchant/captain approval RPCs are service-role only, transactional, idempotent,
  audited, and emit notification/outbox records.
- The inactive-admin database elevation defect was fixed as described above.

### Client and secret boundary

- Admin public environment parsing rejects missing/placeholder values, non-HTTPS remote
  URLs, credentials embedded in URLs, and Supabase service-role/secret keys.
- CI client-secret scanning passed on the merged branch head.
- Production E2E fixtures are designed to fail closed, but real production build and
  secret-store evidence is still required.

### API protection

- Production CORS requires explicit HTTPS origins and rejects wildcards.
- The backend sets secure headers, body-size limits, request IDs, JSON content-type
  enforcement, proxy bounds, and rate limits.
- Cashfree calls use bounded abort timeouts; webhook validation uses the raw body,
  timestamp replay window, HMAC verification, event/status validation, INR validation,
  and exact paise conversion.
- Error mapping returns controlled 4xx/5xx responses without provider or SQL detail.

## Database and migration findings

The four migrations introduced by the merged pull request were reviewed:

- Customer cancellation: locks order/payment/reservations, restricts cancellation to
  documented pre-acceptance states, releases reservations exactly once, transitions
  through the authoritative state function, terminates alerts, creates one refund and
  outbox event, and restricts RPC execution to service role.
- Merchant/captain approval: validates eligible account/shop/KYC/bank/licence/vehicle
  state, writes profile/domain changes, audit, notification, and outbox records in one
  transaction, and is idempotent.
- Operations dashboards: validates filters/cursors/limits, uses bounded keyset
  pagination, derives money from authoritative integer-paise order data, and is
  service-role only.
- Automatic refund result: locks refund/payment/order/return rows, rejects provider ID
  conflicts, reconciles payment and order ledgers atomically, records immutable audit
  and outbox events, and is service-role only.

The new authorization migration is forward-only and does not delete or rewrite a
released migration. Database clean-rebuild/pgTAP CI must pass on the remediation head
before code readiness can be upgraded.

## API parity result

The merged branch-head CI passed OpenAPI lint and generated-client/controller parity.
The existing readiness evidence reports 169 non-excluded operations with zero
runtime-only routes, zero OpenAPI-only routes, and zero duplicate routes. The CI also
built and tested the generated API client through workspace gates. Exact standalone
filter commands must be rerun or observed on the remediation head.

## Core transaction evidence

Automated evidence on the merged branch head covers:

1. COD order placement and idempotent inventory reservation.
2. Concurrent last-unit protection and immutable inventory movements.
3. Merchant urgent alert, acknowledgement, acceptance/rejection, packing, and ready
   states.
4. Exclusive captain assignment, pickup-code validation, delivery OTP, exact COD, and
   exactly-once earnings/balance effects.
5. Customer cancellation and merchant/admin rejection reservation release/refund paths.
6. Payment webhook signature, replay, ordering, and idempotency behavior.
7. Admin approvals, live-order observation, audit, and selected recovery commands.

This is strong code evidence, but it is not a release-environment end-to-end proof.
Real provider, SMS/OTP, FCM/background-device, and staging database checks remain open.

## Frontend integration status

- Generated API operations compile in the repository gates.
- Current covered journeys include customer discovery/COD/order detail, merchant COD
  fulfilment, captain COD delivery, admin sign-in/AAL2, operational dashboard, account
  approvals, audit filters, and shared loading/error/empty/access-denied primitives.
- Client mutations use server-authoritative responses and idempotency keys for critical
  commands.
- The complete frozen screen inventory remains incomplete. Material gaps include full
  customer online-payment/return/support experiences, merchant catalogue/inventory/
  finance/support self-service, captain onboarding/earnings/history/support, and full
  admin investigation/recovery/support/finance/configuration workflows.

## Verification matrix

| Command or check | Result | Evidence / notes |
|---|---|---|
| `git status --short` | NOT RUN | Local checkout was not mounted. |
| `git branch --show-current` | NOT RUN | Branch/ref verified through GitHub API. |
| `git log --oneline --decorate -15` | NOT RUN | Merge and recent commits verified through GitHub API. |
| `git diff --check` | NOT RUN | Must run in a normal checkout before merge. |
| conflict-marker search | PASS (API search) | No `<<<<<<<` or `>>>>>>>` code-search matches. |
| `git ls-files -u` | NOT RUN | Local index unavailable. |
| branch contains `main` | PASS | GitHub compare: ahead of `main`, behind by zero after fast-forward. |
| `pnpm install --frozen-lockfile` | PASS on merged branch head | GitHub Actions run `30245189770`. Remediation-head run pending. |
| `pnpm format:check` | PASS on merged branch head | Static-quality job. Remediation-head run pending. |
| `pnpm lint` | PASS on merged branch head | Static-quality job. Remediation-head run pending. |
| `pnpm typecheck` | PASS on merged branch head | Static-quality job; 16-package evidence in prior audit. |
| `pnpm test` | PASS on merged branch head | Application-tests job. |
| `pnpm test:integration` | PASS on merged branch head | Application-tests job; prior audit records 48 files / 179 tests. |
| `pnpm db:test` | PASS on merged branch head | Database/OpenAPI job; prior audit records 75 files / 1,556 assertions. |
| `pnpm openapi:check` | PASS on merged branch head | Database/OpenAPI job. |
| `pnpm --filter @vastra/api-client contract:check` | PASS on merged branch head | Database/OpenAPI job; 169-operation parity. |
| `pnpm --filter @vastra/api-client build` | COVERED on merged branch head | Invoked by top-level test/build workflows; not observed as a separate step. |
| `pnpm --filter @vastra/api-client typecheck` | COVERED on merged branch head | Workspace typecheck; not observed as a separate step. |
| `pnpm --filter @vastra/api-client test` | COVERED on merged branch head | Workspace test; not observed as a separate step. |
| `pnpm build` | PASS on merged branch head | Workspace-build job; 16-package evidence in prior audit. |
| `pnpm test:frontend:e2e` | COVERED on merged branch head | `test:frontend:harness` ran all configured Playwright projects. |
| `pnpm test:frontend:visual` | COVERED on merged branch head | Visual project included in frontend harness; nine baselines. |
| `pnpm test:pilot-tooling` | PASS on merged branch head | Static-quality job. |
| `pnpm pilot:evidence:check` | PASS on merged branch head | Structure only; execution gates remain unrun. |
| `pnpm security:client-secrets` | PASS on merged branch head | Static-quality job. |
| remediation narrow tests | PENDING | To be executed by remediation-head CI. |

## Fixed files

- `supabase/migrations/20260727090000_admin_status_authorization_hardening.sql`
- `supabase/tests/0096_admin_status_authorization.test.sql`
- `apps/backend/src/finance/refund-execution.worker.ts`
- `apps/backend/src/finance/refund-execution.worker.test.ts`
- `docs/implementation/post-merge-production-readiness-audit.md`

## Required environment and infrastructure checks

- Apply all migrations to a staging copy and run clean rebuild, pgTAP, advisor, query
  plan, and concurrency/load checks there.
- Execute the complete order-to-delivery acceptance flow against release Supabase,
  Cashfree sandbox/approved test account, SMS/OTP provider, and physical FCM devices.
- Verify merchant foreground/background/killed-app urgent ringing and captain offers on
  supported Android devices.
- Rehearse duplicate/out-of-order payment webhooks, provider timeouts, refund retries,
  COD mismatch, dispatch failure, and admin recovery.
- Validate production secrets/origins in the approved secret store; prove no E2E fixture
  can activate in a production build.
- Verify deployment promotion, forward-fix/rollback procedure, graceful shutdown,
  backup restore, dashboards, dead-letter/outbox alerts, payment/refund alerts, and
  on-call routing.
- Resolve the Group Style scope conflict and either complete the frozen frontend
  inventory or formally reduce the pilot scope.
- Attach release-environment evidence and obtain product, engineering, security, finance,
  and operations sign-off.

## Final verdict at report creation

- Code readiness: **NOT READY** — remediation-head CI is pending.
- Deployment readiness: **NOT READY** — staging migration/smoke, production environment,
  deployment, rollback/forward-fix, and restore evidence are absent.
- Operational/pilot readiness: **NOT READY** — real provider/device flows, monitoring,
  complete pilot evidence, scope alignment, frontend completeness decision, and owner
  sign-offs are absent.

The code verdict may be upgraded to **READY WITH EXPLICIT CONDITIONS** only after the
remediation head passes the full applicable repository gates. Deployment and pilot
verdicts must remain **NOT READY** until the external gates above are evidenced.
