---
sprint: 10
ticket: S10-05
status: implemented
return_window_days: 7
---

# S10-05 customer return eligibility and request

Customers can inspect item-level return eligibility for a delivered order, create one idempotent return request for one or more remaining quantities, and read the complete request, item and status history. The MVP return window closes seven days after `delivered_at`.

Requested refund amounts are calculated from immutable order-item totals. The client cannot submit a refund amount. The database locks the order and selected items, verifies ownership and quantities, and rejects duplicate or excessive quantities under concurrent requests.

For fraud resistance, quantities in any previously created return request remain consumed in S10-05. A later authorized return-decision workflow may explicitly release a rejected quantity; customers cannot release or overwrite it themselves.

Normal repository CI is the mandatory merge gate for the complete S10-05 vertical slice.
