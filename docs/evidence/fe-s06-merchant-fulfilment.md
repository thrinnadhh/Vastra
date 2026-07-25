# FE-S06 merchant COD fulfilment evidence

## Scope

This manifest covers the Frontend Sprint 06 merchant journey:

```text
notification readiness
→ urgent order alert
→ acknowledgement or direct decision
→ authoritative order review
→ accept or reject
→ packing
→ item verification
→ ready for pickup
→ captain state
→ pickup-code handover
→ authoritative pickup confirmation
```

The backend order, alert, packing, dispatch, authorization, and idempotency contracts remain
authoritative. The merchant application never creates a local-only terminal transition.

## Ticket mapping

### FE-S06-01 — merchant shell and readiness

- explicit permission-denied and permission-blocked states;
- Android and physical-device requirements;
- urgent channel, custom sound, vibration, native FCM token, and backend-registration checks;
- single-flight setup and retry;
- session-expiry, offline/stale, and backend-registration recovery;
- accessible diagnostics, ringtone test, settings path, and supported battery guidance.

### FE-S06-02 — urgent merchant alert

- existing urgent channel, ringtone, vibration, countdown, and five-second authoritative poll
  are preserved;
- acknowledgement remains retryable without hiding a valid alert;
- transient order reads do not stop audio or clear the alert;
- authoritative non-actionable state, expiry, or successful handling clears the alert;
- direct accept/reject reuses the same decision component as order detail;
- invalid-state races request authoritative refresh.

### FE-S06-03 — order queue and decision

- cursor-overlap order IDs are deduplicated without replacing the authoritative API client;
- polling pauses while an order detail is active;
- loading, empty, stale, offline, authorization, and session-expiry copy is retained;
- accept and reject remain full-order actions;
- preparation time and rejection-note validation follow the existing contracts;
- duplicate submission is blocked and recoverable retry retains the same logical action;
- invalid-state decisions refresh authoritative order state before another decision.

### FE-S06-04 — packing, ready, and handover

- durable packing checklist, manual verification, barcode verification, mismatch handling,
  and ready blocking are preserved;
- one ready attempt retains its idempotency key across retries;
- generated `getMerchantOrderDelivery` and `getMerchantPickupCode` operations own handover
  reads;
- captain searching, assigned, at-store, and picked-up states are explicit;
- pickup code is requested only after authoritative arrival and an explicit merchant action;
- pickup code remains in component memory only and is cleared on hide, state change, pickup,
  or unmount;
- pickup completion is reported only after authoritative dispatch state confirms pickup.

### FE-S06-05 — cross-journey verification

Focused automated tests cover readiness recovery, token registration classification, urgent
alert preservation and direct decisions, queue deduplication, decision races, packing and
verification, generated handover parsing, pickup-code privacy, duplicate actions, and
authoritative pickup completion.

## Evidence classification

| Evidence class | Status | Evidence or remaining requirement |
|---|---|---|
| Automated CI | Pending exact-head completion | Repository formatting, secret scan, lint, strict TypeScript, unit tests, integration tests, frontend harness, database tests, OpenAPI validation, and build must pass on the final PR head. |
| Deterministic app tests | Implemented; final CI pending | Jest and React Native Testing Library tests use fixed IDs, clocks, and mocked ports. They validate application behavior only. |
| Browser harness | Pending exact-head completion | The existing Chromium fixture/visual harness remains a platform-contract check; it does not emulate native FCM or Android audio behavior. |
| Android emulator | Not supplied | Emulator evidence may validate layout and permission recovery, but cannot prove a native physical-device FCM token or manufacturer background behavior. |
| Physical Android device | Required before pilot; not supplied | Validate foreground, background, killed-app, locked-screen, custom ringtone, vibration, notification channel, token rollover, and battery-restriction guidance on an approved device. |
| Staging/backend | Required before pilot; not supplied | Run a real COD order through alert delivery, decision, packing, dispatch assignment, pickup-code read, captain verification, and authoritative pickup observation. |
| External FCM provider | Required before pilot; not supplied | Preserve provider delivery receipts and timestamps without storing private payload or token values in this document. |

## Privacy evidence

The automated suite must verify behavior without placing these values in logs, routes,
screenshots, snapshots, or committed evidence:

- access tokens;
- native FCM push tokens;
- device fingerprints;
- complete alert payloads;
- pickup codes.

Pickup-code tests may use synthetic fixed values in process memory. They are not production
secrets and must not be included in browser screenshots or uploaded evidence artifacts.

## Release boundary

Sprint 06 coding is not pilot-complete solely because automated CI passes. Physical Android,
real FCM delivery, and staging COD evidence remain mandatory external release gates. This
manifest must be updated with approved artifact references only after those runs actually
occur.
