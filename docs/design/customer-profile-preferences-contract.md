# Customer profile and optional preferences contract

Ticket: `FE-S03-05`

## Supported behavior

- The authenticated `/me` result remains the source of truth for customer identity and account status.
- Category, preferred-size, and per-item budget preferences are optional.
- Preferences load and save through the generated `getCustomerPreferences` and `replaceCustomerPreferences` operations.
- Existing style, occasion, and colour preferences are preserved when the onboarding surface edits only category, size, and budget fields.
- Money is submitted as integer paise, and duplicate saves are blocked while a request is pending.
- Load and save failures remain recoverable, and customers may skip optional preferences.

## Contract limitation

The repository does not expose an approved customer profile update operation. `BE-FE-001` retains ownership of that backend and OpenAPI work. The frontend therefore displays the server-owned name when present and explicitly states that name editing is unavailable when absent. It does not create a client-only profile success state.

## Exclusions

This ticket does not change authentication, location, root navigation, checkout, orders, backend code, OpenAPI, database migrations, RLS, or product scope.
