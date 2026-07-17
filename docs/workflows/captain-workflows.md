---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# Captain Workflows

## 1. Onboarding

```text
OTP login
→ Complete personal details
→ Upload KYC
→ Add vehicle
→ Add bank account
→ Submit
→ Admin approval
→ Training acknowledgement
→ Eligible to go online
```

## 2. Go online

```text
Restore an authenticated CAPTAIN session
→ Request foreground location permission
→ Submit a high-accuracy location sample with sampleId
→ Backend validates approval, Android push registration, freshness, and accuracy
→ PUT /v1/captain/me/availability with AVAILABLE
→ Begin foreground location updates every 10 seconds
→ Later dispatch waves may select the captain while readiness remains true
```

Captain-controlled states are `OFFLINE`, `AVAILABLE`, and `ON_BREAK`. Delivery-owned states such
as `OFFERED`, `ASSIGNED`, `AT_PICKUP`, and `DELIVERING` cannot be overwritten by the client.
A location older than 120 seconds or less accurate than 100 metres makes the captain ineligible
for new offers even if the stored availability value remains `AVAILABLE`.

S8-02 uses foreground location only. Background active-delivery tracking is introduced with the
customer tracking workflow, not by the availability screen.

## 3. Delivery offer

```text
Receive push/realtime offer
→ View pickup distance, drop distance, expected earnings, COD flag
→ Accept or reject before timeout
```

Accept flow:

```text
Backend locks task
→ Confirm task unassigned
→ Assign captain
→ Cancel competing offers
→ Status = ASSIGNED
→ Notify customer and merchant
```

## 4. Pickup

```text
Navigate to merchant
→ Call merchant if required
→ Mark arrived
→ View package count
→ Enter pickup code
→ Confirm pickup
→ Start live tracking
```

## 5. Drop

```text
Navigate to customer
→ Call customer if required
→ Mark arrived
→ Collect COD if applicable
→ Enter delivery OTP
→ Confirm delivery
→ Earnings created
```

## 6. Merchant delay

```text
Mark arrived
→ Select Order not ready
→ Start wait timer
→ Notify operations
→ Continue waiting, reassign, or cancel task based on decision
```

## 7. Customer unavailable

```text
Call customer
→ Wait required duration
→ Record attempts
→ Select Customer unavailable
→ Contact operations
→ Retry, reschedule, or return to merchant
```

## 8. Other failures

Supported reasons:

- Merchant closed
- Incorrect address
- Customer refused
- Vehicle issue
- Package damaged
- Unsafe location
- Other

Every failure records:

- Reason
- Timestamp
- Location
- Note
- Evidence when necessary
- Operations decision

## 9. COD

```text
Show expected amount
→ Confirm collected amount
→ Complete delivery
→ Increase captain COD balance
→ Deposit/reconcile later
```

## 10. Support and emergency

- In-app support ticket
- Call operations
- Emergency support
- Safety guidance
