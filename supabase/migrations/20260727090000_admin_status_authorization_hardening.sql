-- Prevent suspended, blocked, or deleted administrator profiles from retaining
-- database-level administrator privileges through an existing AAL2 session.
--
-- Backend guards already reject inactive accounts. This forward-only repair keeps
-- direct Supabase/RLS authorization aligned with the same deny-by-default rule.

create or replace function authz.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.has_aal2()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.status::text = 'ACTIVE'
        and (
          p.account_type::text = 'ADMIN'
          or exists (
            select 1
            from public.admin_profiles ap
            where ap.user_id = p.id
          )
        )
    );
$$;

revoke all
on function authz.is_admin()
from public;

grant execute
on function authz.is_admin()
to authenticated, service_role;
