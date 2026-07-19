---
sprint: 11
ticket: S11-01
status: implemented
---

# Sprint 11 hardening and Tirupati pilot contracts

## Decision

Sprint 11 prepares the frozen Vastra MVP for a limited Tirupati pilot. It does not add product features. A passing build is necessary but not sufficient: the sprint closes only after automated evidence, manual/device evidence, operational rehearsal, defect review, and owner sign-off support a go decision.

## Ticket order

1. **S11-01 — Pilot scope, evidence model, and release criteria**
   - Freeze tickets, evidence statuses, blocking severities, and go/no-go rules.
2. **S11-02 — Acceptance execution and defect register**
   - Execute the canonical customer, merchant, captain, admin, finance, Wardrobe, and Group Style acceptance matrix.
   - Record every failure with severity, owner, reproduction steps, and disposition.
3. **S11-03 — Security and client-secret audit**
   - Add automated client-secret guardrails.
   - Review dependency risk, committed secrets, authentication boundaries, storage privacy, and privileged backend configuration.
4. **S11-04 — RLS and actor-isolation review**
   - Prove customer, merchant, captain, support, operations, and finance isolation across public tables, RPCs, Storage, and Realtime.
5. **S11-05 — Critical-path load and concurrency tests**
   - Exercise discovery reads, checkout, order placement, merchant order reads, captain assignment, payment events, refunds, and admin recovery.
   - Reject any result that permits negative inventory, duplicate financial commands, or double assignment.
6. **S11-06 — Device matrix and merchant-alert physical testing**
   - Verify customer, merchant, and captain apps across supported Android devices and adverse lifecycle/network states.
   - Merchant foreground, background, killed-app, locked-screen, permission, battery-saver, and acknowledgement behavior require physical-device evidence.
7. **S11-07 — Payment, refund, and COD failure drills**
   - Rehearse invalid, duplicate, delayed, and out-of-order webhooks; provider timeouts; refund recovery; and COD shortage/excess disputes.
8. **S11-08 — Backup, restore, and rollback rehearsal**
   - Restore a clean environment from backup, verify critical records, and prove the forward-fix/rollback decision process.
9. **S11-09 — Observability dashboards and operational alerts**
   - Cover API health, database health, outbox lag, merchant-alert delivery, unassigned orders, payment/refund failures, and COD disputes.
10. **S11-10 — Incident runbooks**
    - Document detection, containment, diagnostics, recovery, escalation, communication, and evidence capture for pilot-critical incidents.
11. **S11-11 — Deployment rehearsal and pilot configuration**
    - Rehearse staging-to-production promotion without production traffic.
    - Freeze the Tirupati service zone, pilot actors, support ownership, feature flags, and rollback ownership without storing secrets.
12. **S11-12 — Defect closure and go/no-go**
    - Publish test, security, performance, device, backup, and deployment evidence.
    - Produce an explicit `GO` or `NO_GO`; conditional language must list a time-bounded owner and may not waive a critical gate.

## Evidence statuses

- `NOT_RUN` — execution has not started.
- `PASS` — acceptance criteria passed and evidence paths are attached.
- `FAIL` — criteria failed; notes and a defect are required.
- `BLOCKED` — execution cannot proceed; notes and an owner are required.
- `NOT_APPLICABLE` — excluded by the frozen pilot boundary with rationale.

## Severity policy

- `CRITICAL` — can expose private data, corrupt money/inventory/order state, duplicate financial commands, double-assign delivery, lose authoritative events, or prevent safe rollback. Blocks pilot.
- `HIGH` — materially breaks a core pilot workflow or operational recovery. Blocks pilot unless fixed and rerun.
- `MEDIUM` — degraded but recoverable behavior with a documented workaround.
- `LOW` — minor defect with no core-flow or safety impact.

## Go/no-go rules

A `GO` requires all of the following:

- every critical check is `PASS` or justified `NOT_APPLICABLE`;
- no open `CRITICAL` or `HIGH` defect;
- full repository CI is green on the proposed release commit;
- physical merchant-alert evidence is attached;
- payment/refund/COD failure drills pass;
- backup restore and deployment rehearsal pass;
- rollback, incident, support, product, and engineering owners are named;
- product and engineering owners sign the evidence manifest.

`NO_GO` is mandatory when a critical acceptance, security, RLS, financial, inventory, assignment, backup, or rollback gate fails or remains unexecuted.

## Parallelization boundary

Independent evidence collection may run in parallel after S11-01. Shared migrations, auth/RLS contracts, payment state machines, release configuration, and the evidence manifest must have a single owner at a time.

## Completion boundary

Automation may validate evidence structure and execute repository checks. It must not mark physical-device tests, external provider drills, backup restore, deployment rehearsal, or owner sign-off as passed without attached execution evidence.