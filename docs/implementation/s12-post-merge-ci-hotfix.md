# S12 post-merge CI hotfix

## Incident

PR #151 was merged as commit `17f85aac79971b6e6a80684c4bea0a8a1213b372`, but CI run `30253736911` failed during job setup because the pinned `pnpm/action-setup` and `actions/setup-node` revisions could not be resolved. No repository verification lane executed.

The merged refund worker also depended on a TypeScript interface without an explicit Nest runtime injection token, and the client bundle scanner could report success when required build output directories were missing.

## Remediation

- Pin `pnpm/action-setup` and `actions/setup-node` to immutable revisions previously resolved successfully by this repository.
- Inject `RefundExecutionService` explicitly while keeping the worker constructor typed against the narrow `RefundProcessorPort` interface.
- Add a Nest testing-module regression proving the worker dependency resolves.
- Require every expected Next.js and Expo output directory to exist and contain at least one scannable artifact.
- Add dedicated regression tests for missing and empty bundle output directories.

## Readiness while this PR is open

- Code readiness: **BLOCKED pending complete green CI on this hotfix head**.
- Deployment readiness: **NOT READY**.
- Operational/pilot readiness: **NOT READY**.

No code, deployment, or pilot readiness claim may be upgraded until the required `Verify repository` check passes on the exact final PR head. External staging, provider, physical-device, load, recovery, monitoring, and owner-sign-off requirements remain tracked by issue #140.
