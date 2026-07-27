# Post-merge production-readiness audit

---
audit_date: 2026-07-27
target_branch: fix/s12-post-merge-ci-hotfix
incident_merge_commit: 17f85aac79971b6e6a80684c4bea0a8a1213b372
verified_code_commit: 64a4553a7e9d56cef2735814f9d96c3f4951cd6b
verification_run: 30258003678
code_readiness: ready-with-explicit-conditions
deployment_readiness: not-ready
operational_pilot_readiness: not-ready
---

## Executive summary

PR #151 was merged before its required CI completed successfully. CI run `30253736911`
failed during job setup because three pinned GitHub Action revisions could not be resolved,
so none of the repository verification lanes executed against that merge.

The post-merge review also identified:

- a NestJS runtime dependency-injection defect in `RefundExecutionWorker`, where an erased
  TypeScript interface had no explicit runtime injection token;
- a fail-open condition in the final client-bundle scanner, which could report success when
  required build output directories were absent or empty.

PR #154 repairs these findings. Its runtime-code head
`64a4553a7e9d56cef2735814f9d96c3f4951cd6b` passed the complete repository gate in CI run
`30258003678`.

## Verification scope and result

The CI run tested GitHub's pull-request merge ref for PR #154, combining the listed code
head with the current `main` base. Every required lane and the final aggregation job passed.

| Gate | Result |
|---|---|
| Immutable GitHub Action resolution | PASS |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm format:check` | PASS |
| `pnpm env:check` | PASS |
| `pnpm test:pilot-tooling` | PASS |
| `pnpm pilot:evidence:check` | PASS |
| `pnpm security:client-secrets` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS |
| `pnpm test:integration` | PASS |
| `pnpm db:test` | PASS |
| `pnpm openapi:check` | PASS |
| generated API-client/controller contract check | PASS |
| frontend E2E and visual harness | PASS |
| complete workspace build | PASS |
| fail-closed final client-bundle secret scan | PASS |
| final `Verify repository` aggregation | PASS |

This report does not claim results for an unmounted developer working tree, staged files,
or local-only Git index state. The pull request's required checks remain authoritative for
the final report-only head.

## Fixed findings

### CI supply-chain resolution

The workflow now pins `pnpm/action-setup`, `actions/setup-node`, and `supabase/setup-cli`
to immutable revisions that were previously resolved successfully by this repository.
The checkout and artifact actions remain pinned to immutable revisions.

### Refund worker runtime wiring

`RefundExecutionWorker` keeps the narrow `RefundProcessorPort` compile-time interface but
uses `RefundExecutionService` as its explicit Nest runtime injection token. A Nest testing
module regression compiles and resolves the worker, preventing a repeat of the erased-
interface startup failure.

The worker also retains bounded shutdown waiting, single-flight drain behaviour, duplicate
bootstrap protection, rejection-safe cleanup, and deterministic lifecycle tests.

### Final-bundle secret scan

The scanner now requires every expected Next.js and Expo build output directory to exist
and contain at least one scannable artifact. Missing, empty, or zero-output builds fail the
gate. Dedicated tooling tests cover complete, missing, and empty output matrices.

## Remaining code and security work

The hotfix does not claim to close unrelated repository-wide hardening work. In particular:

- legacy `SECURITY DEFINER` functions with broader search paths still require systematic
  consolidation where previously documented;
- overlapping permissive RLS advisor findings still require query-plan and policy review;
- the canonical Group Style product-scope conflict remains unresolved;
- mutation-testing targets and broader supply-chain checks remain follow-up work unless
  separately evidenced.

These items must remain tracked and risk-ranked; they are not grounds for claiming full
production deployment readiness.

## Deployment and pilot blockers

Deployment remains **NOT READY** until production-like staging evidence exists for:

- migrations from clean and production-equivalent baselines;
- production secrets and environment configuration;
- final deployed bundle attestation;
- Cashfree, SMS/OTP, FCM, realtime, and physical-device flows;
- monitoring, alerting, rollback, backup/restore, and recovery drills;
- representative load, query-plan, and invariant evidence.

Operational/pilot readiness remains **NOT READY** until issue #140 is completed against one
immutable release commit, including physical Android evidence, the full staging COD journey,
admin recovery drills, load thresholds, invariant checks, and product, engineering, and
operations sign-offs.

## Final three-part verdict

1. **Code readiness — READY WITH EXPLICIT CONDITIONS.** The corrected runtime code passed
   every required repository verification lane. The final report-only PR head must retain a
   green required `Verify repository` status and no unresolved critical/high review finding.
2. **Deployment readiness — NOT READY.** Environment, migration, provider, monitoring,
   rollback, and recovery evidence remain incomplete.
3. **Operational/pilot readiness — NOT READY.** Release-bound staging, device, load,
   recovery, and owner-sign-off evidence remains incomplete.
