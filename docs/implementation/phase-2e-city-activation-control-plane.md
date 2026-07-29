---
project: Vastra
phase: 2E
status: implementation-verification
issues:
  - 165
  - 166
  - 167
  - 168
---

# Phase 2E city configuration and activation control plane

## Decision

Phase 2E implements city configuration and lifecycle control as one fail-closed vertical slice. The database remains authoritative; the NestJS backend exposes typed, permission-aware commands; the admin dashboard renders only parsed API contracts; and no client receives direct write access to Supabase tables.

## Workstream closure

| Workstream | Production scope | Acceptance evidence |
| --- | --- | --- |
| 2E-01 | Versioned configuration, zone and pincode commands | optimistic versions, UUID idempotency, mandatory reason, immutable audit, scoped authorization and pgTAP coverage |
| 2E-02 | Activation preflight, activate, pause and restore | immutable report, current configuration/readiness versions, 30-minute freshness gate, fail-closed lifecycle transitions and city isolation |
| 2E-03 | Backend and OpenAPI control plane | strict gateway parsers, thin controllers, stable error mapping, generated-client parity and focused unit tests |
| 2E-04 | Admin city-management interface | configuration editor, zone/pincode visibility, readiness truth, preflight checklist, typed lifecycle confirmation, responsive layout and browser regression |

## Security and integrity invariants

- `anon` and `authenticated` roles cannot execute Phase 2E mutation RPCs.
- New evidence tables are private, RLS-enabled, forced-RLS and service-role-only.
- Configuration and readiness changes require the expected current version.
- A reused idempotency key with different input fails as a conflict.
- A service zone cannot be made `ACTIVE` through the ordinary zone command.
- Activation requires the latest passing report to match city status, configuration version and readiness version, and to be no older than 30 minutes.
- Activation reports and configuration history are append-only.
- Pausing a city stops new affected commerce while retaining existing order and recovery data.
- Existing finance audit resource types remain valid after the city audit extension.

## Truthful evidence boundary

Repository tests may insert a synthetic passing report solely to prove lifecycle consumption of a current immutable report. That test fixture is not provider, staging or production launch evidence.

The following remain explicitly external and `NOT_RUN` until executed against the release candidate:

- production-like Supabase migration application;
- real payment, SMS/OTP and FCM provider health;
- a physical customer → merchant → captain validation order;
- physical Android critical journeys;
- production-shaped load and query-plan validation;
- monitoring, rollback, backup/restore and incident-recovery drills;
- founder, operations, support and finance go/no-go approval.

## Verification matrix

The merge candidate must pass, on one immutable final commit:

1. formatting, lint, strict TypeScript and environment/secret checks;
2. backend unit and integration suites;
3. OpenAPI lint and generated operation/controller parity;
4. clean Supabase reset, complete historical pgTAP and Phase 2E test `0103`;
5. admin component tests, production build and Playwright city-control-plane regression;
6. workspace build and final bundle-secret scan;
7. final repository aggregation gate;
8. CodeRabbit review with no unresolved actionable finding;
9. removal of every temporary materialisation or patch workflow.

The exact final commit and CI run are recorded in the pull request after all gates complete. A green repository CI run proves code readiness for this phase; it does not by itself approve commercial production activation.
