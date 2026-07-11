Implement payments, returns, refunds, and settlement eligibility in focused tickets.

Scope:

- One online payment provider
- Checkout initialization
- Raw-body signature verification
- Webhook event deduplication
- Payment state machine
- Failed-payment recovery
- Return request and evidence
- Merchant inspection
- Admin decision
- Refund creation and webhook processing
- Merchant settlement eligibility
- Captain payout eligibility
- COD reconciliation

Acceptance:

- Client payment success is not authoritative.
- Duplicate and out-of-order webhooks are safe.
- Refund is idempotent.
- Private evidence uses signed URLs.
- Return and refund histories are preserved.
- Finance permissions are enforced.
- Failed financial events alert operations.
- Tests use sandbox/test credentials only.

Return a ticket plan first. Execute one ticket at a time.
