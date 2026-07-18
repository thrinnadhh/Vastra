-- Keep captain COD liability entries backend-only while satisfying the
-- repository-wide requirement that every public table has an explicit RLS policy.

create policy captain_cod_ledger_service_role_access
on public.captain_cod_ledger
for all
to service_role
using (true)
with check (true);
