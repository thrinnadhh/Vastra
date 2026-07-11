# Backend-Specific Instructions

These rules extend the repository `AGENTS.md`.

## Structure

Use one module per business capability:

```text
controller
service
repository
dto
validators
authorization
events
tests
```

Controllers:

- Parse request context.
- Call one application service.
- Map domain errors to documented API errors.
- Contain no business rules.

Services:

- Enforce business state and authorization.
- Start critical transactions.
- Produce domain/outbox events.
- Return stable DTOs.

Repositories:

- Contain data access.
- Never silently bypass ownership or RLS assumptions.
- Support row locking for critical concurrency.

## API contract

- Follow `docs/api/openapi.yaml`.
- Do not add undocumented endpoints.
- Use shared error codes from `docs/api/error-codes.md`.
- Use cursor pagination for growing lists.
- Require `Idempotency-Key` where specified.
- Update OpenAPI and contract tests in the same change when a contract changes.

## Transactions

Use a database transaction and row locks for:

- Order placement
- Inventory adjustments
- Offline sales
- Merchant accept/reject
- Captain assignment
- Pickup confirmation
- Delivery completion
- Refund creation
- Settlement adjustments

Write history and outbox events in the same transaction as state changes.

## Security

- Verify Supabase JWTs server-side.
- Enforce account status.
- Enforce resource ownership.
- Enforce admin permissions.
- Never log tokens, OTPs, secrets, or full sensitive documents.
- Service-role credentials are backend-only.

## Testing

Add:

- Unit tests for rules
- Integration tests for transactions
- Concurrency tests for last-unit inventory and captain assignment
- Contract tests against OpenAPI
- Authorization tests for every protected resource
