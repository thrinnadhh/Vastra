# Sprint 11 device and merchant-alert matrix

## Evidence rule

Every executed row must record UTC time, app commit, app build identifier, device model, Android version, network state, result, tester, and a redacted screenshot/video/log reference. Do not enter `PASS` from emulator-only evidence for the physical merchant-alert gate.

## Required devices

| Class | Minimum evidence |
|---|---|
| Low-memory Android | One physical device with constrained memory and battery optimization enabled |
| Current Android | One physical device on the latest supported Android version |
| Older supported Android | One physical device on the minimum supported Android version |
| Different OEM | At least two OEM notification implementations across the matrix |
| Tablet/large display | Layout smoke test when the app declares support |

## Customer app

Execute registration/OTP, home, search, product variant, cart, COD checkout, online checkout, order tracking, cancellation, return, support, Wardrobe, and Group Style on:

- stable Wi-Fi;
- unstable mobile data;
- temporary offline state and recovery;
- process restart during an active order;
- expired session;
- denied and later granted notification permission;
- small and large text scaling.

## Merchant app — blocking physical gate

For a committed new order, verify:

| State | Expected result |
|---|---|
| Foreground | Urgent modal appears and looping alert starts once |
| Background | High-priority notification appears with the dedicated channel and configured sound |
| Killed process | Notification appears and opens the correct order context |
| Locked screen | Heads-up/lock-screen behavior matches OS permission and privacy settings |
| Battery saver | Alert remains deliverable or the limitation is surfaced during onboarding |
| Notification permission denied | App exposes a persistent blocked state and recovery action |
| Notification permission restored | Subsequent alerts use the dedicated channel without reinstalling |
| Duplicate FCM delivery | One effective alert session; acknowledgement remains idempotent |
| Acknowledgement | Sound/modal stops and durable retries cease |
| Network loss after delivery | Acknowledgement retries safely without duplicating the command |
| App update/restart | Existing active alert state reconciles from the backend |

Record alert-created, provider-send, device-receive, UI-presented, and acknowledged timestamps where available.

## Captain app

Execute online/offline, offer delivery, exclusive acceptance, navigation handoff, pickup code, delivery OTP, failure reasons, COD completion, earnings, and support under:

- foreground/background transitions;
- stale offer acceptance;
- location permission denied/restored;
- poor GPS accuracy;
- unstable network during pickup/delivery confirmation;
- duplicate confirmation attempts.

## Blocking conditions

The pilot is `NO_GO` when:

- a committed merchant order does not produce an actionable physical-device alert;
- acknowledgement does not stop retries;
- killed-app delivery is unsupported without a documented product-owner decision;
- an app exposes private data after session expiry, member removal, or account suspension;
- device lifecycle recovery creates duplicate orders, assignments, payments, refunds, or delivery completion.
