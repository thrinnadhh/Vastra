Implement the admin MVP in focused tickets.

Frozen roles:

- Super Admin
- Operations Admin
- Support Admin
- Finance Admin

Scope:

- Admin authentication and MFA path
- Dashboard
- Live orders
- Order timeline
- Merchant approval
- Captain approval
- Manual assignment/reassignment
- Support tickets
- Returns queue
- Refund actions
- Payment/settlement views
- Product moderation
- Banner/basic coupon
- Audit log

Acceptance:

- Backend enforces permissions.
- Sensitive actions require reason.
- Sensitive writes create audit records.
- Unauthorized role tests pass.
- Admin cannot silently bypass order state.
- No direct database-edit UI.
- Filters and operational state are recoverable after errors.

Return a ticket plan first. Execute one ticket at a time.
