---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# Admin Workflows

## 1. Merchant approval

```text
Open pending merchant
→ Review profile, shop, location, and documents
→ Run verification checks
→ Approve, reject, or request correction
→ Record reason
→ Audit decision
→ Notify merchant
```

The collector of documents should not approve their own application when maker-checker is enabled.

## 2. Captain approval

```text
Open pending captain
→ Review KYC, licence, vehicle, and bank details
→ Approve, reject, or request correction
→ Audit
→ Notify captain
```

## 3. Live-order monitoring

```text
Open Live Orders
→ Filter by delayed, unassigned, merchant timeout, captain issue, or payment issue
→ Open order
→ Review timeline and participants
→ Contact relevant party
→ Perform permitted action
→ Add internal note
→ Audit sensitive action
```

## 4. Manual captain assignment

```text
Open unassigned order
→ View eligible captains
→ Select captain
→ Backend locks delivery task
→ Assign captain
→ Notify captain, merchant, and customer
```

## 5. Reassignment

```text
Open active task
→ Select reason
→ Release current captain
→ Preserve assignment history
→ Offer/assign new captain
→ Notify all parties
```

## 6. Order override

```text
Open order
→ Select permitted override
→ Enter mandatory reason
→ Confirm impact
→ Execute transaction
→ Add order history and audit log
```

Overrides must be rare and permission-gated.

## 7. Support ticket

```text
Open queue
→ Assign ticket
→ Read context
→ Contact customer/merchant/captain
→ Add public message or internal note
→ Resolve or escalate
→ Close after confirmation
```

## 8. Return and refund

```text
Open return
→ Review order, eligibility, customer evidence, and merchant response
→ Approve, reject, or resolve dispute
→ Create refund
→ Finance approves when required
→ Provider processes refund
→ Notify customer
```

## 9. Settlement review

```text
Open settlement batch
→ Review gross sales, fees, refunds, adjustments
→ Approve or flag
→ Initiate transfer
→ Track provider status
→ Notify merchant
```

## 10. Suspension

```text
Open account
→ Select reason
→ Review active obligations
→ Suspend
→ Prevent new activity
→ Preserve history
→ Audit
→ Notify account owner
```
