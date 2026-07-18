---
sprint: 9
ticket: S9-07
status: implemented
---

# S9-07 captain operational controls

Admins can inspect captain eligibility, location freshness, cash liability, earnings and active delivery state. Narrow commands support suspension, safe pre-pickup assignment release, guarded availability correction and restore-to-offline. A captain carrying a picked-up package cannot be suspended or released through these controls; operations must resolve the active delivery first. All mutations are idempotent and immutably audited.

Repository CI validates formatting, lint, types, tests, database contracts, OpenAPI and the production build before merge.
