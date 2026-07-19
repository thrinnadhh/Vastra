-- S10-08 hardening: every public table must have an explicit RLS policy.

create policy return_admin_decisions_service_role_all
on public.return_admin_decisions
for all
to service_role
using (true)
with check (true);

create policy return_admin_decision_items_service_role_all
on public.return_admin_decision_items
for all
to service_role
using (true)
with check (true);
