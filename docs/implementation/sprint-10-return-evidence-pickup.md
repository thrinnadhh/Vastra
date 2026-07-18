---
sprint: 10
ticket: S10-06
status: implemented
bucket: return-evidence
---

# S10-06 private evidence and reverse pickup

Return evidence is stored in a private Supabase Storage bucket. The backend validates evidence type, MIME type and a 15 MiB maximum, creates a customer/return-scoped object key, and returns a one-time signed upload URL. Metadata can be finalized only from an unexpired database intent after the object exists. Reads use five-minute signed URLs; public object URLs are never stored.

An AAL2 finance administrator with `admin.returns.manage` can create exactly one active `RETURN_PICKUP` delivery task after a return reaches `APPROVED`. The command is idempotent and audited. Pickup uses the immutable customer address snapshot from the order and drop-off uses the canonical shop address and location.

S10-06 creates the reverse task and moves the return to `PICKUP_ASSIGNED`; existing captain dispatch and lifecycle primitives remain authoritative for assignment and custody transitions.

Normal repository CI is the mandatory merge gate for private storage, upload intent expiry, signed reads, authorization and reverse-pickup concurrency.
