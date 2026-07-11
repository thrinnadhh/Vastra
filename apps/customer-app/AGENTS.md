# Customer App Instructions

These rules extend the repository `AGENTS.md`.

## Product boundary

Build only the frozen customer MVP.

Do not implement:

- Group Style
- Body scan
- AI fitting
- Virtual try-on
- Wallet
- Loyalty
- Multi-shop cart

Leave future navigation entries absent or behind disabled feature flags approved by product documentation.

## Data access

- Use Supabase directly only for authentication, permitted reads, Realtime subscriptions, and signed uploads.
- Use the Vastra backend for orders, payments, returns, and other critical writes.
- Never include a service-role key.
- Use the shared generated API client and domain types.

## UX

Every network screen requires:

- Loading skeleton
- Empty state
- Error state
- Retry
- Offline handling
- Pull-to-refresh where sensible

Preserve cart/form input after recoverable failures.

## Commerce rules

- Enforce one-shop cart in UI, but rely on backend for final enforcement.
- Display money from integer paise.
- Refresh cart when backend reports price or stock conflict.
- Do not show order success until backend confirms the order.
- Payment provider UI is not the final source of payment state.

## Testing

Test:

- OTP and session restoration
- One-shop cart
- Price/stock conflict
- Duplicate submission prevention
- Cancellation eligibility
- Tracking updates
- Permission-denied and offline states
- Accessibility labels
