# Limited Tirupati pilot configuration

This document records the non-secret pilot boundary. Environment-specific identifiers may be added only after approval. Never store credentials, private contact details, KYC, payment data, OTPs, access tokens, or exact home addresses here.

## Pilot boundary

| Setting | Frozen value |
|---|---|
| City | Tirupati, Andhra Pradesh |
| Mode | Limited invite-only pilot |
| Product scope | Frozen Vastra MVP only |
| Multi-shop cart | Disabled |
| Virtual try-on/body scanning/AI sizing | Disabled |
| Unapproved recommendations/features | Disabled |
| Real-money traffic | Disabled until signed `GO` |
| Pilot service zone | `TBD_APPROVED_POLYGON_OR_RADIUS_REFERENCE` |
| Pilot start/end UTC | `TBD` |
| Maximum pilot customers | `TBD` |
| Maximum pilot merchants | `TBD` |
| Maximum pilot captains | `TBD` |
| Operating hours | `TBD` |
| Maximum concurrent live orders | `TBD` |

## Ownership

| Responsibility | Named owner |
|---|---|
| Product go/no-go | `TBD` |
| Engineering release | `TBD` |
| Operations incident lead | `TBD` |
| Finance/refund escalation | `TBD` |
| Merchant onboarding/support | `TBD` |
| Captain onboarding/support | `TBD` |
| Customer support | `TBD` |
| Database backup/restore | `TBD` |
| Rollback decision/execution | `TBD` |
| Security/privacy escalation | `TBD` |

## Pilot actor requirements

### Merchants

- approved KYC and verified shop;
- confirmed operating hours, service radius, catalogue, price, and stock ownership;
- supported physical Android device;
- notification permission and dedicated urgent channel verified;
- onboarding and manual fallback contact completed;
- test order and acknowledgement evidence attached.

### Captains

- approved identity/onboarding;
- supported physical Android device and location permission;
- availability, offer, pickup code, delivery OTP, COD, failure, earnings, and support training completed;
- COD liability and payout rules acknowledged;
- manual escalation route confirmed.

### Customers

- invite-only synthetic/internal accounts first;
- serviceable address inside the approved zone;
- support and privacy notice available;
- payment/refund expectations communicated before real-money enablement.

## Traffic controls

The approved release configuration must support:

- pilot traffic disabled by default;
- bounded actor allowlists or equivalent invite control;
- bounded service zone and operating hours;
- ability to pause new orders without corrupting active orders;
- ability to disable online payments while retaining safe COD/offline recovery only when product/finance owners approve;
- ability to disable a merchant/captain/account through existing admin controls;
- ability to stop background workers safely and resume durable queues.

## Sign-off requirement

Replace every `TBD` before S11-11 can pass. The values must be reviewed without committing secrets or private personal information. The final evidence report should reference the approved secure source for private contact/actor lists.
