# Vastra limited Tirupati pilot evidence

This directory contains Sprint 11 execution plans and evidence for the limited Tirupati pilot.

## Rules

1. Do not mark a check `PASS` until the referenced evidence exists in the repository or in an approved immutable external evidence store.
2. Never commit secrets, production credentials, private customer data, KYC documents, return evidence, payment payloads, OTPs, access tokens, or unredacted device identifiers.
3. Redact screenshots and logs before attaching them.
4. Every failed or blocked critical/high check must have a defect owner and notes.
5. The evidence manifest is the release decision source of truth.
6. CI validates structure only. Manual and external-system checks remain `NOT_RUN` until actually executed.

## Evidence layout

- `evidence/manifest.json` — machine-validated release gates, defects, decision, and sign-off.
- `reports/` — generated or manually reviewed execution reports. Create reports only after running the corresponding procedure.
- `device-matrix.md` — physical-device and app-lifecycle execution matrix.
- `load-test-plan.md` — staging-only performance and concurrency procedure.
- `payment-failure-drills.md` — payment, refund, webhook, and COD recovery drills.
- `backup-restore-rehearsal.md` — backup, restore, and rollback evidence procedure.
- `observability-alerts.md` — pilot dashboards, metrics, and alert thresholds.
- `incident-runbooks.md` — operational incident response procedures.
- `deployment-rehearsal.md` — staging-to-production rehearsal and rollback process.
- `pilot-configuration.md` — non-secret pilot scope and ownership configuration.

## Commands

```bash
pnpm pilot:evidence:check
pnpm security:client-secrets
pnpm test:pilot-tooling
```

Before a go decision, run:

```bash
pnpm pilot:go-no-go
```

`pilot:go-no-go` is intentionally strict and must fail while critical checks are unexecuted, failed, blocked, or unsigned.

## Report naming

Use UTC dates and stable ticket identifiers:

```text
docs/pilot/reports/S11-05-load-2026-07-19.json
docs/pilot/reports/S11-06-merchant-device-2026-07-19.md
docs/pilot/reports/S11-08-restore-2026-07-19.md
```

Evidence paths in the manifest must be repository-relative and may not escape the repository root.
