# Codex prompt pack — merchant, captain, and admin MVP completion

Use `00-master-frontend-contract.md`. Execute exactly one named `FE-S11-*`, `FE-S12-*`,
or `FE-S13-*` ticket.

## Sprint 11 — merchant catalogue, inventory, and shop operations

Catalogue, variant, image, inventory, movement, and offline-sale APIs are the most
frontend-ready areas. Audit existing modules and types before adding UI.

Requirements:

- product/variant forms use supported fields, validation, SKU, barcode, images, and
  authorization for the merchant's shop only;
- inventory is variant-level and server-authoritative;
- adjustments require supported reasons and preserve immutable movement history;
- scan/manual search recover from unknown/duplicate barcode states;
- offline sales are idempotent and distinguish success, failure, and unknown retry;
- shop status/profile/hours, returns, sales, settlement, followers, and support remain
  gated by their self-service OpenAPI coverage;
- no direct client inventory balance mutation or floating-point money.

## Sprint 12 — captain onboarding, finance, and support

Captain self-service KYC, earnings/history, COD reconciliation, payout, support, and
emergency contracts are partial or missing. Do not reuse admin-only endpoints in the
captain client.

Requirements when ready:

- OTP/KYC/approval/suspension/profile/vehicle states are role-safe;
- earnings/history/payout values are server-authoritative integer money and immutable
  delivery history;
- COD reconciliation clearly distinguishes pending, submitted, disputed, and settled
  states supported by the contract;
- support/emergency actions are prominent, privacy-minimal, and safe while driving;
- offline/weak-network states do not imply a mutation succeeded.

## Sprint 13 — admin completion

Each admin area must have explicit OpenAPI reads/actions and server permission. Existing
uncontracted controllers do not count as frontend-ready.

Areas:

- merchant/captain approval and KYC;
- customer search and support queue;
- returns/refunds/payments/settlements/payouts/COD;
- catalogue moderation;
- banners/basic coupons;
- audit logs and four-role admin-user management.

Every privileged action requires consequence copy, confirmation, operational reason
when required/supported, idempotent progress, authoritative refresh, and audit outcome.
Tables must be server-paginated/filterable, keyboard accessible, and non-colour-only.

## Evidence

- authorization and cross-tenant/role tests;
- duplicate/concurrency tests for inventory/offline sale/finance decisions;
- form and state accessibility;
- operational E2E for the selected capability;
- applicable mobile physical-device or admin Playwright evidence;
- no uncontracted endpoint or local authoritative calculation.
