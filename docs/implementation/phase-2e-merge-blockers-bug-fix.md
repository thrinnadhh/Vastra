# Bug-Fix Task

## Observed behavior

PR #169 implemented Phase 2E, but CI run #1296 failed in the database lane. The pgTAP assertion read the service-zone wrapper using the wrong JSON path, and activation reports created inside one transaction shared `now()` timestamps, making the latest report nondeterministic. Seven review threads also identified lifecycle error conflation, OpenAPI create/update drift, over-broad city-list scope, missing branch activation history, unexercised RLS isolation, non-modal dialog handling, and missing create-route 404 contracts.

## Expected behavior

Database tests execute every planned assertion deterministically. Invalid target values map to input rejection, illegal lifecycle states map to conflict, only global administrators and `CITY_ADMIN` assignments can read the control plane, every bulk-activated branch receives immutable same-transaction history, authenticated clients cannot read private evidence tables, the confirmation dialog uses native modal semantics, and OpenAPI distinguishes create requests from versioned updates while documenting not-found responses.

## Reproduction

1. Check out PR #169 at `f557f6399ab6a1bbb167ebd381edb2eaf0da6ce0`.
2. Run `pnpm db:test`.
3. Observe assertion 18 returning `NULL` from `zones[0].id`, followed by `ADMIN_CITY_PREFLIGHT_REQUIRED` and a bad 39-test plan ending at 28 assertions.
4. Inspect the seven unresolved CodeRabbit threads on PR #169.

## Evidence

- Logs: GitHub Actions CI run #1296, `Database and OpenAPI` job.
- Request ID: Not applicable; repository verification failure.
- Order ID: Not applicable.
- Screenshot: Playwright evidence passed and is unrelated to the database failure.
- Environment: GitHub-hosted Ubuntu 24.04, Node.js 20.20.2, pnpm 8.15.0, Supabase CLI 2.109.1.
- App version: PR #169 head `f557f6399ab6a1bbb167ebd381edb2eaf0da6ce0`.

## Constraints

- Reproduce before changing code.
- Add a failing regression test first where practical.
- Fix the root cause, not only the visible symptom.
- Preserve unrelated behavior.
- Run relevant full workflow tests.
- Document data-repair needs separately.

## Verification

Before the permanent repair commit was pushed, the guarded repair workflow passed the focused backend gateway suite, all 49 Phase 2E pgTAP assertions, OpenAPI validation, and generated-client contract parity. The modal source repair subsequently passed Prettier 3.9.5, repository-wide lint, and repository-wide typecheck with the file-specific `react-hooks/refs` suppression removed. Commit `f46818329db38ab5d88bf1e2edfe9e1117997069` contains the clean source change with the temporary workflows, codemods, diagnostics, and configuration overrides removed. The repository-wide exact-head CI remains the final merge gate.

## Data repair

No production data repair is required because this migration has not been merged. If equivalent SQL was applied to an external environment, backfill branch activation history from city audit entries and branch timestamps before enforcing history completeness.
