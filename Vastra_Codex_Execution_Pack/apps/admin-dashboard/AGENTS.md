# Admin Dashboard Instructions

These rules extend the repository `AGENTS.md`.

## Roles

Frozen roles:

- Super Admin
- Operations Admin
- Support Admin
- Finance Admin

Do not invent additional production roles without updating product documentation, permissions, and tests.

## Authorization

- Every page and action requires backend permission enforcement.
- Hiding a button is not authorization.
- Use least privilege.
- Show access denied instead of silently failing.

## Sensitive actions

Require confirmation and reason for:

- Order override
- Cancellation after acceptance
- Merchant/captain suspension
- Manual assignment or reassignment
- Refund approval
- Settlement adjustment
- Permission changes

Display the expected impact before confirmation.

## Audit

Sensitive writes must display or link to resulting audit entries where useful.

Never directly edit production database rows from the dashboard.

## UX

Operational screens require:

- Fast filters
- Stable pagination
- Status badges with text and colour
- Complete timeline
- Internal notes
- Clear stale/live data indicators
- Error recovery without losing filters

## Testing

Test role matrices, denied actions, audit creation, duplicate submissions, and concurrent operations.
