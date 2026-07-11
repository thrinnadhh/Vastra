# Merchant App Instructions

These rules extend the repository `AGENTS.md`.

## Product boundary

There is one merchant app and one merchant login controlling one shop in the MVP.

Do not create merchant staff roles or branch switching.

## New-order alert

This is a critical workflow.

Required:

- Dedicated Android notification channel
- High-priority background push
- Distinct custom order sound
- Strong vibration
- Foreground urgent modal
- Repeated reminders controlled by backend alert state
- Explicit acknowledgement
- Response countdown
- Test Ringtone screen
- Clear setup warning when notification permission/channel is disabled

Do not promise sound through every OS silent or do-not-disturb setting.

The sound must stop on acknowledgement, accept, reject, expiry, or cancellation.

## Inventory

- Inventory is variant-specific.
- Barcode and manual search are MVP.
- Photo recognition is post-MVP.
- All adjustments call backend APIs.
- Never directly update `stock_on_hand`.
- Show the resulting balance and movement after successful adjustment.
- Require a reason for stock correction and damage.

## Orders

- Merchant accepts the complete order or rejects the complete order.
- No substitution or partial fulfilment in MVP.
- Ready for Pickup remains disabled until required verification is complete.
- Handover requires pickup code.

## Testing

Use physical Android devices for:

- Foreground alert
- Background alert
- Killed-app alert
- Permission denied
- Notification channel disabled
- Weak network
- Duplicate alert
- Alert acknowledgement
- Countdown expiry
- App restart during active order
