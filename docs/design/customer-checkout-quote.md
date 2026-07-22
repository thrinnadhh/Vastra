# Customer checkout quote and fees

## Ticket audit

- **Ticket:** `FE-S05-03`
- **Classification:** `READY`
- **Boundary:** harden the existing quote request and rendering surface while preserving COD placement and confirmation.
- **Existing behavior preserved:** `customer-order-placement*`, `customer-order-confirmation*`, and `default-customer-checkout-quote.tsx` are unchanged.
- **API operation:** `createCustomerCheckoutQuote` through the existing typed quote client.
- **Server authority:** address snapshot, item availability, integer-paise prices, discounts, fees, tax, ETA, and quote expiry are rendered exactly from the response.
- **Contract gaps:** coupon application and online payment remain intentionally unsupported.
- **Shared-file conflicts:** none. Cart, orders, backend, OpenAPI, application root, and navigation are untouched.

## Hardening

The quote request now has a dedicated in-flight guard in addition to stale-operation suppression. Repeated refresh input cannot create duplicate quote requests. The selected server-returned address is visible in the review surface, fee and discount rows remain integer-paise safe, zero discounts are explicit, stock shortfalls are announced, and the totals card is a polite live region.

Transport and temporary provider failures may retain a visibly stale quote. Authentication, invalid cart, changed price, stock, serviceability, and expired quote states never manufacture a successful path. COD placement keeps its existing idempotency key and duplicate-submission protection.

## Verification

The repaired branch passes the focused checkout-quote Jest suite, repository formatting, ESLint, and TypeScript validation. The pull request remains draft until its GitHub Actions check completes successfully.
