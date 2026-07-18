---
sprint: 10
ticket: S10-10
status: implemented
commission_bps: 1000
---

# S10-10 merchant settlement eligibility and ledger

A finance administrator can preview eligible orders for a shop and freeze one settlement ledger for a date period. The MVP commission is fixed at 1,000 basis points (10%); clients and administrators cannot submit a commission rate.

An order is eligible only after delivery, the seven-day return window, confirmed online payment or reconciled COD, and the absence of active returns or support disputes. A unique partial index prevents one order credit from appearing in two settlements. Completed refunds are frozen as separate deduction rows and cannot be deducted twice.

Creating the ledger does not transfer money. The settlement enters `REVIEW` with immutable order-credit, commission and refund rows. A later payout-execution workflow must approve and send the frozen net amount.
