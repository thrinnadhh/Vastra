# S12 post-merge CI hotfix

## Incident

PR #151 was merged as commit `17f85aac79971b6e6a80684c4bea0a8a1213b372`, but CI run `30253736911` failed during job setup because the pinned `pnpm/action-setup`, `actions/setup-node`, and `supabase/setup-cli` revisions could not be resolved. No repository verification lane executed.

The merged refund worker also depended on a TypeScript interface without an explicit Nest runtime injection token, and the client bundle scanner could report success when required build output directories were missing.

## Remediation

- Pin `pnpm/action-setup`, `actions/setup-node`, and `supabase/setup-cli` to immutable revisions previously resolved successfully by this repository.
- Inject `RefundExecutionService` explicitly while keeping the worker constructor typed against the narrow `RefundProcessorPort` interface.
- Add a Nest testing-module regression proving the worker dependency resolves.
- Require every expected Next.js and Expo output directory to exist and contain at least one scannable artifact.
- Add dedicated regression tests for missing and empty bundle output directories.

## Verification

Runtime-code commit `64a4553a7e9d56cef2735814f9d96c3f4951cd6b` passed required CI run `30258003678`, including static quality, typecheck, unit and integration tests, database/OpenAPI/contracts, frontend E2E and visual verification, workspace build, fail-closed final-bundle scanning, and the final `Verify repository` aggregation.

## Readiness while this PR is open

- Code readiness: **READY WITH EXPLICIT CONDITIONS**.
- Deployment readiness: **NOT READY**.
- Operational/pilot readiness: **NOT READY**.

The final report-only PR head must retain a green required `Verify repository` status and no unresolved critical or high-severity review finding. External staging, provider, physical-device, load, recovery, monitoring, and owner-sign-off requirements remain tracked by issue #140.
