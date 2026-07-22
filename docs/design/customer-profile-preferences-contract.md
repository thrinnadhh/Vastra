# Customer profile and optional preferences contract

Ticket: `FE-S03-05`
Backend follow-up: `BE-FE-001` customer profile update slice

## Supported behavior

- The authenticated `/me` result remains the source of truth for customer identity, profile-completion state, and account status.
- Incomplete customer sessions are routed to required profile setup before the five-tab application is exposed.
- Required profile setup and later name editing use generated `updateCurrentCustomerProfile` (`PATCH /me/profile`).
- The server atomically updates the customer-owned display name and marks `profileCompleted` true.
- Category, preferred-size, and per-item budget preferences remain optional.
- Preferences load and save through the generated `getCustomerPreferences` and `replaceCustomerPreferences` operations.
- Existing style, occasion, and colour preferences are preserved when the preferences surface edits only category, size, and budget fields.
- Money is submitted as integer paise, and duplicate saves are blocked while a request is pending.
- Profile and preference failures remain recoverable; required profile setup cannot be skipped, while optional preferences may be skipped.

## Authority and security

- Account identity comes from the bearer token and `auth.uid()`; the client never submits a customer ID.
- Only active `CUSTOMER` accounts can use the mutation.
- A valid non-customer `/me` response remains parseable so the customer session boundary can reject it explicitly as the wrong application.
- Phone number and avatar remain server-owned and are not changed by this operation.
- The database RPC is atomic and does not grant direct profile-table update access to authenticated clients.

## Remaining BE-FE-001 scope

Account deletion remains a separate destructive workflow requiring deletion semantics, dependency cleanup, authorization, audit, and tests. It is not part of Sprint 3 profile setup and is not simulated through local logout.

## Exclusions

This slice does not change location, root-tab ownership, checkout, orders, discovery preferences, phone identity, avatar media, or account-deletion behavior.
