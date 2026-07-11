# Captain App Instructions

These rules extend the repository `AGENTS.md`.

## Delivery integrity

- A captain may view only offered or assigned tasks.
- Offer acceptance must be idempotent.
- Backend decides exclusive assignment.
- Pickup requires the correct pickup code.
- Delivery requires OTP or an audited admin override.
- COD amount must match backend expectations.
- Do not allow client-side status skipping.

## Location

- Request only permissions required by the current workflow.
- Explain why background location is needed.
- Stop active tracking after task completion/cancellation.
- Include timestamps and accuracy.
- Ignore stale local state after backend rejects an update.
- Never expose another captain’s location.

## Failure flows

Every failure action records:

- Reason
- Time
- Location when available
- Optional note/evidence
- Backend decision

Supported MVP reasons must match business documentation.

## Testing

Test:

- Two captains accepting one task
- Expired offer
- Wrong pickup code
- Wrong delivery OTP
- COD mismatch
- Location disabled
- Weak network
- App resumed after process death
- Admin reassignment
- Customer unavailable
