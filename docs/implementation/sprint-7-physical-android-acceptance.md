---
ticket: S7-10
sprint: 7
status: implementation-complete-physical-run-required
---

# Sprint 7 Merchant Alert Physical Android Acceptance

## Scope

Validate the production merchant new-order alert path on a physical Android device after an EAS or native Android build includes Firebase configuration and the bundled `vastra_new_order.wav` sound.

Automated CI verifies contracts, database concurrency, payload parsing, application builds, and API authorization. It cannot prove OEM background delivery, speaker volume, vibration strength, or lock-screen presentation; those require the matrix below on physical hardware.

## Required setup

- Install a non-Expo-Go Android build of `in.vastra.merchant` with the correct Firebase `google-services.json` or EAS FCM credentials.
- Sign in with an active merchant account that owns a verified shop.
- Open **Alert setup** and confirm every automated check is `READY`.
- Keep a second test account available to place a COD order for that shop.
- Record device manufacturer, Android version, app build, network, battery mode, and result evidence.

## Acceptance matrix

| Case | App state | Screen state | Expected result |
|---|---|---|---|
| A1 | Foreground | Orders queue visible | Urgent modal appears, bundled ringtone loops, countdown decreases, and the order number matches the committed backend order. |
| A2 | Foreground | Another order detail visible | Urgent modal overlays safely without losing current navigation state. |
| A3 | Background | Home screen or another app | High-importance notification appears on `vastra_urgent_orders` with custom sound and strong vibration. |
| A4 | Killed | Process removed from recents | Notification appears; tapping it restores the session and shows the urgent modal, and acknowledgement opens the authoritative order detail. |
| A5 | Locked | Screen locked | Private lock-screen notification appears without customer phone, address, token, or secret data. |
| A6 | Permission denied | Notifications disabled | Alert setup shows actionable permission guidance and opens Android settings. |
| A7 | Channel muted | Urgent channel sound disabled | Alert setup identifies that the custom sound/channel needs attention. |
| A8 | Multiple merchant devices | Two active Android devices | Both eligible devices receive the alert; each provider result is visible in operations activity. |
| A9 | Acknowledge | Alert active | **Acknowledge & review order** stops foreground sound, dismisses the notification, persists acknowledgement, and opens current server order data. |
| A10 | Accept/reject elsewhere | Delayed duplicate arrives | Client may display the push briefly, but authoritative order read prevents an invalid decision and scheduler stops later reminders. |
| A11 | No response | Alert remains active | At most three durable reminder events are queued at the frozen cadence, then the alert expires at the database deadline. |
| A12 | Token revoked | FCM returns `UNREGISTERED` | Only the invalid device is revoked; other devices remain eligible and operations metrics count the invalid token. |
| A13 | Offline then reconnect | Foreground | Acknowledgement shows a recoverable error; retry succeeds without a duplicate acknowledgement event. |
| A14 | Battery optimisation | Restricted OEM mode | Document whether delivery is delayed; apply manufacturer-specific allowlisting guidance and rerun background/killed cases. |

## Evidence record

For every device/build combination, attach:

- a screen recording for A1, A3, A4, A5, A9, and A11;
- operations API snapshots from `/v1/admin/merchant-alerts/metrics` and `/v1/admin/merchant-alerts/activity`;
- FCM/provider failure evidence for A12;
- the exact Android notification-channel settings page;
- pass/fail, observed latency, and any OEM-specific setup required.

## Release gate

Sprint 7 code may merge when CI is green. Production rollout remains blocked until A1–A14 are recorded on at least:

1. one Google/stock Android device;
2. one Samsung device;
3. one aggressive-background OEM device commonly used in the launch market.
