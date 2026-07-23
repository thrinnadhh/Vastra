# FE-S05-05 browser evidence

Captured from the customer-app web production surface using synthetic data only.

## Files

- `mobile-browser-evidence.jpg` — compact contact sheet covering active/past orders, order detail before tracking starts, stale delivery tracking, delivery OTP visible at `CAPTAIN_AT_CUSTOMER`, expired OTP hidden, offline stale-data warning, session-expiry cache purge, and unauthorized detail without customer snapshot leakage.
- `orders-list-desktop.jpg` — responsive desktop rendering of active and past customer orders.

## Browser assertions

- Active and terminal orders are separated into **Active** and **Past** sections.
- Tracking is unavailable/not started outside eligible lifecycle states.
- A stale location is explicitly labelled.
- Delivery OTP is lifecycle-gated and removed after server expiry.
- Recoverable offline refresh retains data only with a visible `STALE DATA` warning.
- Session expiry removes cached order data.
- Authorization denial reveals no customer, shop, address, tracking, or OTP snapshot.

## Automated validation

- Focused orders/tracking Jest: 8 suites, 37 tests.
- Full customer-app Jest: 53 suites, 258 tests.
- Strict ESLint and TypeScript passed.
- Expo web production export passed with 362 modules.

The screenshots were reduced for repository review; the assertions above are also enforced by the committed component and adapter tests.
