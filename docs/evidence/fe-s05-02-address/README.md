# FE-S05-02 customer address evidence

Ticket: `FE-S05-02`

GitHub Actions evidence run: `29978981655` (successful).

## Deterministic scenarios

| File | Scenario |
|---|---|
| `loading-mobile.png` | Initial loading skeleton and live-region label |
| `empty-mobile.png` | Empty addresses with add-address recovery |
| `success-mobile.png` | Checkout selection at 390 × 844 |
| `success-desktop.png` | Checkout selection at 1440 × 1024 |
| `error-mobile.png` | Recoverable unavailable response |
| `offline-mobile.png` | Offline response with retry |
| `stale-mobile.png` | Visible addresses explicitly marked stale after failed refresh |
| `unauthorized-mobile.png` | Customer-safe authorization failure |
| `session-expired-mobile.png` | Session-expiry recovery |
| `delete-modal-mobile.png` | Settled delete confirmation on mobile |
| `delete-modal-desktop.png` | Settled delete confirmation on desktop |
| `delete-modal-dismissed-mobile.png` | Address list restored after Escape dismissal |

## Accessibility assertions

The capture waits for browser animation completion, focuses the confirm action, and performs six sequential Tab presses. The job fails if focus leaves the modal. Escape must hide the dialog before the dismissed-state screenshot is accepted.

## Validation

- focused address Jest: 5 suites, 23 tests passed;
- full customer-app Jest: 51 suites, 245 tests passed;
- customer-app ESLint: passed with zero warnings;
- customer-app TypeScript: passed;
- Expo web production export: passed, 345 modules bundled;
- `git diff --check`: passed.

Fixtures contain synthetic data only. No production or real customer data is included.
