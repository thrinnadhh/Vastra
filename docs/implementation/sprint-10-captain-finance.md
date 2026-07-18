---
sprint: 10
ticket: S10-11
status: implemented
---

# S10-11 captain earnings, COD reconciliation and payout eligibility

Every completed delivery receives at most one frozen captain earning. Online-paid delivery earnings become available immediately; COD earnings remain pending until the corresponding collection is reconciled.

COD collections create an append-only captain-liability ledger. An AAL2 finance manager records the deposited amount through an idempotent audited command. Exact deposits move the collection to `RECONCILED` and release the earning; shortages or excesses move it to `DISPUTED` and block payout.

Payout creation locks eligible earnings, rejects any captain with unreconciled COD, inserts immutable earning ledger rows, marks each earning `INCLUDED_IN_PAYOUT`, and creates a `REVIEW` payout. This ticket does not initiate a bank transfer.
