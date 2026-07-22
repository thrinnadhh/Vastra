# Customer address contract

Classification: `CONTRACT-GAP` closed by `BE-FE-002`.

The public API now exposes authenticated customer-owned list, create, read, update, delete, and default-selection operations. The backend derives identity exclusively from the authenticated request context. Mutations use UUID idempotency keys and database RPCs; direct authenticated table writes are revoked. Database functions re-check active customer identity, ownership, field and coordinate validity, deterministic default selection, and serviceability.

Serviceability is a server-derived boolean based on verified online-order shops whose service radius contains the address. Saving an unserviceable address is allowed so the UI can explain and recover; checkout remains responsible for validating the chosen address against the cart shop.

## Verification

The repaired branch generates the typed OpenAPI client successfully and passes the focused address tests, repository formatting, ESLint, TypeScript validation, OpenAPI validation, and the workspace build. The pull request remains draft until its full GitHub Actions workflow completes successfully.
