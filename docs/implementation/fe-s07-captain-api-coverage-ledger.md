---
ticket: FE-S07-CONTRACT-READINESS
sprint: FE-S07
status: ready-for-ci
scope: captain-forward-cod
reviewed_commit: 65ac1cce4ff151ac8b592fa1bfeaa7df2e10b312
---

# FE-S07 captain COD API coverage ledger

## Decision

The pilot-critical captain forward-COD journey has complete backend, OpenAPI, authorization,
RLS/RPC and automated-test coverage. FE-S07 may harden and compose the existing captain
implementation without inventing client-only lifecycle transitions.

The authoritative path remains:

```text
AVAILABLE
→ OFFERED
→ ASSIGNED
→ AT_PICKUP
→ PICKED_UP
→ IN_TRANSIT
→ AT_DROP
→ COMPLETED
```

The matching order path remains:

```text
CAPTAIN_SEARCHING
→ CAPTAIN_ASSIGNED
→ CAPTAIN_AT_STORE
→ PICKED_UP
→ OUT_FOR_DELIVERY
→ CAPTAIN_AT_CUSTOMER
→ DELIVERED
```

## Coverage

| FE-S07 action | Public operation | Backend authority | Client boundary | Readiness |
|---|---|---|---|---|
| Restore captain session and role | `getCurrentAccount` | global auth, account-type and operational-readiness guards | captain session restoration and API session | `READY` |
| Read/set availability | `setCaptainAvailability` | captain presence service and availability state machine | captain presence client/screen | `READY` |
| Submit current location | `updateCaptainCurrentLocation` | freshness, accuracy, rate and active-task validation | Expo location provider and presence client | `READY` |
| List offers | `listCaptainDeliveryOffers` | dispatch offer projection, expiry and ownership | captain delivery port | `READY` |
| Accept/reject offer | `acceptCaptainDeliveryOffer`, `rejectCaptainDeliveryOffer` | exclusive assignment locking, offer expiry and idempotency | resilient captain delivery port | `READY` |
| Read active/task projection | `getCaptainActiveDelivery`, `getCaptainDelivery` | assigned-captain privacy projection | resilient single-flight reads | `READY` |
| Arrive at merchant | `arriveCaptainAtPickup` | assignment, state and proximity validation | lifecycle mutation with authoritative reconciliation | `READY` |
| Verify pickup code | `verifyCaptainPickupCode` | hash-only secret, attempt limit, lockout and state transition | retry-stable secret submission | `READY` |
| Depart merchant | `departCaptainPickup` | verified custody and lifecycle validation | lifecycle mutation with authoritative reconciliation | `READY` |
| Arrive at customer | `arriveCaptainAtCustomer` | assignment, state and proximity validation | lifecycle mutation with authoritative reconciliation | `READY` |
| Verify COD and delivery OTP | `completeCaptainCodDelivery` | exact `orders.total_paise`, OTP attempts, idempotency and atomic completion | retry-stable completion attempt | `READY` |
| Release before pickup | `releaseCaptainDeliveryBeforePickup` | audited release back to captain search | captain delivery port | `READY` |
| Report delivery problem | `reportCaptainDeliveryProblem` | immutable event and `PROBLEM_REPORTED` order transition | captain delivery port | `READY` |

## Contract-gap resolution

### Post-pickup failures

There is no captain-controlled terminal `FAILED` or automatic post-pickup reassignment action,
and FE-S07 must not add one. After verified pickup, package custody is explicit. The supported
captain action is `reportCaptainDeliveryProblem`, which records the problem and moves the order
to `PROBLEM_REPORTED`; an authorised operations workflow resolves custody. This is the frozen
Sprint 8 contract and is sufficient for the FE-S07 pilot slice.

Therefore `BE-FE-018` is reclassified from a frontend blocker to a later operations-resolution
enhancement. The captain UI must describe the action as escalation, never as cancellation,
failed completion or reassignment.

### Non-pilot captain surfaces

The following remain outside FE-S07 and do not block the forward-COD pilot transaction:

- captain KYC document submission;
- delivery history;
- earnings and payout history;
- self-service support cases;
- bank payout execution.

They require separate approved contracts and must not be simulated from direct table access.

## FE-S07 implementation invariants

1. The backend owns every lifecycle state.
2. The first idempotency key for one logical attempt is retained across retryable/unknown results.
3. Corrected non-retryable secret input begins a new attempt.
4. Overlapping polls share an authoritative read.
5. Offer and lifecycle races reconcile from the server projection before reporting failure.
6. Authentication failure clears the local session.
7. Pickup codes and delivery OTPs are never logged, routed, persisted or attached to evidence.
8. Physical-device, FCM and staging checks remain `NOT_RUN` until real evidence exists.

## Release boundary

Automated CI can establish `CODE_COMPLETE` and `CI_COMPLETE`. It cannot establish
`PILOT_VERIFIED`. Pilot verification requires the approved Android device matrix, actual FCM
provider delivery, and a real staging customer → merchant → captain COD transaction.
