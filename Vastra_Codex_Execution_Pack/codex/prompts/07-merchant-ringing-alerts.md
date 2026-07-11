Implement the merchant urgent-order alert workflow.

Scope:

- Merchant device registration
- Alert database record
- Outbox event consumer
- FCM high-priority data/notification payload
- Dedicated Android notification channel
- Custom sound
- Vibration
- Foreground urgent modal
- Repeated reminder scheduling
- Acknowledgement endpoint
- Expiry
- Test Ringtone screen
- Notification setup diagnostics
- Monitoring metrics

Acceptance:

- Alert created only after order transaction commits.
- Duplicate events do not create uncontrolled duplicate alerts.
- Acknowledgement stops retries.
- Accept/reject/expiry/cancel stops retries.
- Alert state is observable by admin.
- No secret Firebase credential exists in mobile app.
- Physical-device test checklist is documented.
- Do not use unsupported call/alarm behavior as a shortcut.

Return a ticket plan first. Execute one ticket at a time.
