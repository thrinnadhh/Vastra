---
ticket: FE-S07-PRODUCTION-CLOSURE
sprint: FE-S07
status: implemented-pending-ci-and-external-evidence
scope: captain-forward-cod
base_commit: 47adffedb29b3c60b0e4143d65043f822ed8b263
---

# Frontend Sprint 7 production closure

## Decision

FE-S07-01 through FE-S07-06 are implemented at the repository code and deterministic-test boundary.

This closure does not claim that the connected Supabase project has migration parity, that a real
staging COD transaction passed, or that the approved physical Android/FCM matrix passed. Those
remain blocking release gates in `fe-s07-backend-deployment-audit.md` and Sprint 11 evidence.

## Ticket closure

### FE-S07-01 — captain shell and readiness

- preserves the Deliveries and Availability application sections;
- enforces 48-pixel section targets and explicit tab semantics;
- wraps availability, foreground location, and active-task location traffic in session-expiry
  handling;
- shares overlapping availability reads;
- retains permission, stale-location, operational-state, weak-network, and retry presentation.

### FE-S07-02 — offer lifecycle

- removes expired offers from the visible inbox without waiting for the next ten-second poll;
- preserves the authoritative countdown and privacy-safe pickup summary;
- exposes every supported decline reason;
- retains one idempotency identity through retryable or unknown outcomes;
- reconciles expired, taken, and accepted races from authoritative server projections;
- confirms assignment only after the backend returns the active delivery.

### FE-S07-03 — pickup

- preserves merchant call/navigation, proximity-authoritative arrival, and active-task location;
- keeps the six-digit pickup code in component memory only;
- uses secure entry and clears the code when lifecycle state changes;
- preserves server-owned invalid-code attempts and lockout;
- advances only after the authoritative pickup response.

### FE-S07-04 — drop and COD

- preserves customer call/navigation, arrival, and delivery OTP;
- removes the editable COD field;
- renders `delivery.totalPaise` as the only collection amount;
- requires an explicit exact-cash confirmation before OTP completion;
- sends the immutable server amount to the completion operation;
- preserves retry-safe idempotency and authoritative completion.

### FE-S07-05 — delivery failures

- keeps issue controls collapsed during normal navigation;
- displays a stop-safely warning before any issue input;
- exposes every server-supported pre-pickup release and post-pickup problem reason;
- requires a note for `OTHER`;
- never presents post-pickup cancellation, local failure, or automatic reassignment;
- describes post-pickup action as custody-preserving operations escalation.

### FE-S07-06 — captain COD E2E

Deterministic React Native coverage executes:

`offer → accept → arrive shop → pickup code → depart → arrive customer → exact cash confirmation → delivery OTP → complete`

Additional tests cover expired offers, supported decline reasons, immutable COD, pre-pickup
release, post-pickup custody escalation, overlapping presence reads, and session expiry.

## Privacy and safety invariants

- pickup code and delivery OTP are never logged, routed, persisted, or included in evidence;
- customer contact and address data are visible only for the assigned active task;
- COD is never calculated or edited by the captain;
- the frontend never creates a lifecycle transition that the server did not return;
- issue input is not shown until the captain explicitly opens the stopped-safely flow;
- direct Supabase table access remains prohibited.

## Verification required before merge

- repository formatting;
- client-secret scan;
- strict lint and TypeScript;
- captain application tests, including the production journey;
- complete unit and integration suites;
- frontend browser harness;
- database tests;
- OpenAPI validation;
- workspace build;
- aggregate `Verify repository` check.

## External release gates

The following remain `NOT_RUN` until real evidence is attached:

- connected Supabase ordered migration parity;
- customer → merchant → captain staging COD transaction;
- Android foreground/background/killed/locked-screen behavior;
- actual FCM provider delivery and acknowledgement;
- approved physical-device matrix;
- pilot owner sign-off.
