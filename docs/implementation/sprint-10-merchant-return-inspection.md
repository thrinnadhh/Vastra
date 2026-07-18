---
sprint: 10
ticket: S10-07
status: implemented
---

# S10-07 merchant return receipt and inspection

Merchants can list and inspect only returns belonging to their own shops. Receipt is allowed after reverse-pickup custody completes, records append-only return history, and moves the request to `RECEIVED`.

Inspection is an idempotent all-items command. Every returned line must be submitted exactly once with a non-pending condition and merchant decision. Item inspection becomes immutable after submission. Fully accepted returns move to `VERIFIED`; disputed or partial outcomes return to `REVIEW` for the S10-08 admin decision. Optional merchant evidence remains a private `return-evidence` object key scoped to the return and merchant.

Normal repository CI is the mandatory merge gate for merchant ownership, custody checks, immutable inspection and database contract compatibility.
