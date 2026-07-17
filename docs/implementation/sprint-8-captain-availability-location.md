---
ticket: S8-02
sprint: 8
status: implemented
scope: captain-availability-current-location
---

# Sprint 8 Captain Availability and Current Location

## Decision

S8-02 establishes the authoritative captain presence surface consumed by later dispatch tickets.
It implements client-requested availability, current-location writes, location freshness, and a
backend-only dispatch-readiness projection. It does not create delivery offers or assignments.

The captain client may request only:

```text
OFFLINE
AVAILABLE
ON_BREAK
```

Operational states such as `OFFERED`, `ASSIGNED`, `AT_PICKUP`, `DELIVERING`, and `SUSPENDED`
remain backend-owned. A client request cannot overwrite package custody or an active assignment.

## HTTP surface

Authenticated, operationally ready captain accounts use:

```text
PUT /v1/captain/me/availability
PUT /v1/captain/me/location
```

Availability is a set-state command and is replay safe. Location writes use a client-generated
UUID `sampleId`; replaying the same sample and canonical payload returns the stored result, while
reusing the sample ID with another payload returns `IDEMPOTENCY_KEY_REUSED`.

Mobile clients do not receive direct grants on `captain_profiles`, `captain_current_locations`,
`captain_location_history`, or the private receipt/readiness structures.

## Availability rules

A captain may enter `AVAILABLE` only when all current prerequisites are true:

- the account and profile are active and of type `CAPTAIN`,
- captain KYC is `VERIFIED` and approval exists,
- the captain is not suspended and owns no active forward-delivery task,
- the current location is no older than 120 seconds,
- location accuracy is no worse than 100 metres,
- no active delivery task is attached to the location row,
- a non-revoked Android FCM device is registered with notifications enabled.

`OFFLINE` and `ON_BREAK` remove the captain from dispatch eligibility. Later offer and assignment
transactions remain responsible for backend-owned availability transitions.

## Location rules

The captain app submits one immediate high-accuracy foreground location before requesting
`AVAILABLE`. While the app remains foregrounded and authoritative status is `AVAILABLE`, it
attempts location updates every ten seconds or after meaningful movement.

The backend:

- validates coordinates, accuracy, heading, speed, battery percentage, and client timestamp,
- rejects timestamps more than 30 seconds in the future,
- rejects samples that are not newer than the accepted current sample,
- accepts no more than one new write per five seconds,
- deduplicates samples by `(captain_id, sample_id)`,
- updates the single current-location row transactionally,
- samples durable history at most every 30 seconds unless movement is at least 100 metres or the
  active task changes.

S8-02 requests foreground permission only. Background and killed-app tracking are deliberately
deferred to S8-08, where tracking privacy, customer visibility, and active-delivery lifecycle are
implemented together.

## Database forward fix

The ordered migration:

- adds `recorded_at` and `sample_id` to `captain_current_locations`,
- adds private location-update receipts,
- adds the service-role `captain_dispatch_readiness` projection,
- adds service-role availability and location RPCs,
- preserves forced RLS and backend-mediated writes,
- emits `captain.availability.changed` only when durable availability changes.

The existing delivery foundation is extended rather than replaced. Existing applied migrations
are not edited.

## Dispatch-readiness projection

`private.captain_dispatch_readiness` centralises the S8-01 eligibility conditions so S8-04 does
not duplicate location, device, KYC, profile, availability, or active-task predicates.

A stored `AVAILABLE` value is not by itself proof of eligibility. If the application stops sending
locations, the projection automatically reports `dispatch_eligible = false` once the location is
older than 120 seconds. S8-02 does not add a scheduler that rewrites stale captains to `OFFLINE`;
that is unnecessary for safe offer selection because later dispatch reads the projection.

## Error behaviour

The endpoint surface uses the frozen delivery errors:

- `DELIVERY_REQUEST_INVALID`,
- `CAPTAIN_NOT_ELIGIBLE`,
- `DELIVERY_STATE_CONFLICT`,
- `CAPTAIN_LOCATION_STALE`,
- `IDEMPOTENCY_KEY_REUSED`,
- `LOCATION_UPDATE_RATE_LIMITED`,
- `DELIVERY_SERVICE_UNAVAILABLE`.

Rate limiting is retryable. Eligibility, state, stale-location, and sample-conflict failures are not
automatically retried without new state or a new sample.

## Verification

S8-02 includes:

- validation and service unit tests,
- HTTP integration tests for both frozen endpoints and stable errors,
- captain-app client and accessible screen tests,
- pgTAP coverage for grants, eligibility, deduplication, stale protection, rate limiting,
  history sampling, outbox events, and the readiness projection.

## Exit criteria

- Captains can safely request `OFFLINE`, `AVAILABLE`, and `ON_BREAK`.
- Backend-owned availability states cannot be overwritten by the client.
- `AVAILABLE` requires fresh, accurate location and an eligible Android push device.
- Current location is server-mediated, deduplicated, stale protected, and rate limited.
- Durable location history is bounded.
- Later dispatch tickets have one reusable readiness projection.
- The captain app provides the first authenticated availability and foreground-location flow.
- No offer creation, assignment acceptance, pickup, customer tracking, COD, or completion logic is
  introduced by S8-02.
