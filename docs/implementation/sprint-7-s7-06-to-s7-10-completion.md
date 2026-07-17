---
ticket: S7-06-to-S7-10
sprint: 7
status: implemented
---

# Sprint 7 Second-Half Completion

## S7-06 — Expiry and reminder scheduler

- Durable reminder counters and timestamps live on `merchant_order_alerts`.
- A service-role scheduler claims due alerts with `FOR UPDATE SKIP LOCKED`.
- At most three reminder delivery events are queued at the frozen 60-second cadence.
- Alerts expire durably when their response deadline passes or the order leaves `WAITING_FOR_MERCHANT`.
- The existing delivery worker runs scheduling before draining FCM outbox work.

## S7-07 — Android urgent notification runtime

- The merchant app creates `vastra_urgent_orders` at maximum importance.
- The bundled `vastra_new_order.wav` sound, private lock-screen visibility, lights, badge, and strong vibration are configured.
- Android notification permission, native FCM token acquisition, token rollover, and `/me/devices` registration are handled in the authenticated runtime.
- Foreground, background-response, and killed-app response listeners consume the frozen payload.

## S7-08 — Foreground urgent modal

- A blocking accessible modal shows order number and authoritative response countdown.
- The bundled sound loops only while an unexpired alert is active in the foreground.
- Acknowledgement is persisted before sound dismissal and navigation to the server-backed order detail.

## S7-09 — Test Ringtone and diagnostics

- Alert setup checks physical device, Android permission, channel, custom sound, vibration, native FCM token, and backend registration.
- Test Ringtone plays the bundled asset and posts through the real urgent channel.
- Recoverable setup guidance links to Android settings and calls out battery/background restrictions.

## S7-10 — Observability and acceptance

- Operations-only metrics and activity APIs require an ADMIN account, `operations.manage`, MFA/readiness enforcement, and service-role database functions.
- Metrics cover creation, send, acknowledgement, expiry, reminders, retries, invalid tokens, and outbox backlog.
- The physical Android matrix is documented separately; execution requires real devices and production-like Firebase credentials.

## Finalization

- Expo notification dependencies and the workspace lockfile are synchronized.
- The custom WAV ringtone is committed as a native build asset.
- The merchant queue and OpenAPI contracts are integrated and repository-formatted.
- Automated CI is the merge gate; physical Android evidence remains the production-release gate.
