# Codex prompt pack — Wardrobe, Group Style, and release closure

Use `00-master-frontend-contract.md`. Execute exactly one named `FE-S14-*`, `FE-S15-*`,
or `FE-S16-*` ticket.

## Sprint 14 — Wardrobe and saved looks

Audit and preserve the existing Wardrobe/look implementation before redesigning it.

Privacy and commerce requirements:

- every new wardrobe item is private by default;
- support only repository-backed upload, purchased-item, metadata, and deletion flows;
- do not infer body, size, identity, or clothing attributes from images;
- private media uses approved storage and revocable signed access;
- saved looks support only contracted create/rename/duplicate/edit/delete/detail/share;
- distinguish owned items from nearby shop products;
- refresh shop product price/availability before add-to-cart;
- keep the one-shop cart rule;
- sharing a look never grants access to browse the owner's Wardrobe.

Required tests include private default, authorization, media failure, metadata edit,
delete/revoke, look management, stale product state, and cart conflict.

## Sprint 15 — private Group Style rooms

This sprint is blocked until room APIs have a complete backend module, migrations, RLS,
private storage rules where needed, authorization/idempotency tests, OpenAPI coverage,
and generated types.

The only approved room model supports:

- invitation link or join code and approved membership;
- product/saved-look sharing;
- comments and `LOVE`/`MAYBE`/`SKIP` votes;
- shared shortlist;
- owner member removal and room closure/read-only state;
- abuse reporting;
- individual add-to-cart/checkout under the one-shop rule.

Do not add events, dress codes, palettes, readiness tracking, group shopping lists,
Couple connections, public discovery, shared carts/payments, or automatic Wardrobe
access.

Required E2E: create → invite/join → share → comment/vote → shortlist → individual cart
→ report/close/revoke, including invalid/expired invite, unauthorized access, removed
member, and closed-room behavior.

## Sprint 16 — closure

### Inventory and contract reconciliation

Mark every item in `docs/design/frontend-screen-inventory.md` implemented, blocked,
deferred, or intentionally removed. No undocumented omission is allowed.

### Evidence areas

- deterministic Brand/Commerce/Hybrid visual baselines;
- contrast, target sizes, screen-reader names/roles, focus, dynamic text/zoom, form
  errors, reduced motion, and non-colour status;
- low-end Android launch/scroll/media/navigation behavior;
- admin responsive and keyboard-only critical paths;
- offline, slow, timeout, stale, duplicate, expired-session, and provider-unknown states;
- Wardrobe/Group privacy, role guards, location permission/freshness, and no client
  secrets;
- customer/merchant/captain release builds and admin production build;
- connected physical COD pilot evidence and defect reconciliation.

Use only scripts available in the repository and report exact results. Missing Maestro,
Playwright, visual-regression, device, or provider evidence remains a release gap rather
than a fabricated pass.

## Final comprehension check

Representative Home/discovery surfaces should communicate “all kinds of fashion from
local shops” after five seconds. Ethnic-only or wedding-only interpretation is a
blocking category/imagery balance defect.

## Explicit post-MVP

Vastra Couple, event-based Groups, a separate customer website, AI sizing/body scan,
virtual try-on, automatic wardrobe recognition, and advanced recommendations are not
closure requirements and must not be added as placeholders.
