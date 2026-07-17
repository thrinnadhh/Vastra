-- Keep delivery-attempt history backend-only while satisfying the repository-wide
-- requirement that every public table has at least one explicit RLS policy.

create policy merchant_alert_delivery_attempts_service_role_access
on public.merchant_alert_delivery_attempts
for all
to service_role
using (true)
with check (true);
