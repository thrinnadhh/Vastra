---
sprint: 9
ticket: S9-09
status: implemented
---

# S9-09 versioned operational configuration

Only an explicit allowlist of dispatch, intervention and feature-flag settings is mutable. Values are type- and range-checked in the database, updates require optimistic `expectedVersion`, every prior value is preserved in private append-only history, and all writes are idempotent and audited. Secret settings are never returned by the admin read API.
