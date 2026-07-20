# Codex prompt pack — merchant, captain, and admin COD slice

Use `00-master-frontend-contract.md`. Execute exactly one named `FE-S06-*`, `FE-S07-*`,
or `FE-S08-*` ticket. Operational safety, state accuracy, and recovery take priority
over decoration.

## Sprint 06 — merchant fulfilment

Preserve existing FCM channel/sound, device registration, acknowledgement, countdown,
diagnostics, order queue, accept/reject, packing, and ready behavior.

Requirements:

- readiness reflects notification permission, channel, device registration, ringtone
  test, and supported battery guidance;
- urgent alerts show authoritative order state, expiry, and accessible large actions;
- already-handled/expired/multi-device races recover through a server refresh;
- rejection reason and preparation time follow their contracts;
- packing verification and ready/handover never bypass state validation;
- audio/haptics use approved device settings and background capabilities;
- active operational screens use Commerce mode without ornaments.

Critical E2E: background/foreground alert → accept/reject → prepare → pack/verify →
ready → handover, including multi-device races and physical-device evidence.

## Sprint 07 — captain COD delivery

Preserve existing availability/location, offer, pickup code, delivery OTP, COD, and
completion behavior.

Requirements:

- online readiness requires current permission/GPS/service-area/location conditions;
- offer countdown, expiry/taken race, and assignment confirmation are authoritative;
- pickup and delivery code errors/lockout follow backend rules;
- active delivery exposes one safe next action and privacy-minimal actor data;
- COD amount comes from order data and requires explicit collection confirmation;
- failure reasons and escalation use supported contracts and avoid interaction while
  driving;
- prepaid completion is blocked until the state machine and OpenAPI support it.

Critical E2E: online → offer → accept → merchant/pickup code → customer/delivery OTP →
COD confirm → complete, including failure recovery and physical-device evidence.

## Sprint 08 — admin observation and recovery

Replace only the placeholder surface owned by the selected ticket. Contract every API
read/action before composing it.

Requirements:

- permission-aware routes and navigation; server authorization remains mandatory;
- real counters/queues only—no invented operational metrics;
- supported identifier search and complete order timeline;
- privileged recovery requires confirmation, operational reason when required,
  idempotent progress, authoritative refresh, and audit outcome;
- expose only the personal data needed for the operation;
- tables use server pagination/filtering, semantic status text/icons, keyboard access,
  visible focus, and loading/empty/error states.

Critical E2E: dashboard → search → order → authorized recovery → reason → audit record,
including permission denial, failure/race recovery, and keyboard-only use.

## COD integration checkpoint

After S04–S08, run the connected physical/staging journey:

```text
Customer order
→ merchant alert/accept/pack/ready
→ captain offer/pickup/delivery OTP/COD
→ customer completion/tracking
→ admin visibility and authorized recovery inspection
```

Mocks do not replace physical-device or staging evidence where the pilot contract
requires external execution.
