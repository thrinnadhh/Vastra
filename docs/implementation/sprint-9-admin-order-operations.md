---
sprint: 9
ticket: S9-05
status: implemented
---

# S9-05 controlled order interventions

Admin order mutations are exposed only as narrow commands: cancel an eligible pre-pickup order, restart captain search, release a pre-pickup delivery assignment, or reset a locked verification flow. Every command requires `admin.orders.manage`, MFA, a UUID idempotency key, a stable reason code, bounded notes, canonical database locks and an immutable before/after audit record. Verification resets never return or audit raw pickup codes or delivery OTPs.
