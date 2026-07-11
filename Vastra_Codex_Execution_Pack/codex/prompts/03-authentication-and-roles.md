Implement authentication and role foundations as ordered tickets.

Scope:

- Supabase Auth integration
- public.profiles creation/reading
- Customer, merchant, captain, and admin profile boundaries
- Device registration
- Session restoration
- Admin MFA path
- Backend JWT verification
- Account-status guards
- Permission guards
- RLS tests

Acceptance:

- Customer cannot become merchant/admin by modifying client input.
- Merchant/captain pending status blocks operational actions.
- Admin permission checks occur in backend.
- Devices are associated with authenticated user.
- No secret/service key exists in client bundle.
- Error codes match documentation.
- Tests cover cross-role denial.

Return a ticket plan first. Execute one ticket at a time.
