-- Require an AAL2 Supabase Auth session before an authenticated user is
-- recognized as an administrator by database authorization predicates.
--
-- This protects every existing RLS policy and helper that delegates elevated
-- access through authz.is_admin(). JWTs without an aal claim fail closed to
-- aal1 and therefore receive no administrator privileges.

create or replace function authz.has_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function authz.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.has_aal2()
    and (
      exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.account_type::text = 'ADMIN'
          and p.status::text = 'ACTIVE'
      )
      or exists (
        select 1
        from public.admin_profiles ap
        where ap.user_id = auth.uid()
      )
    );
$$;

revoke all
on function authz.has_aal2()
from public;

revoke all
on function authz.is_admin()
from public;

grant execute
on function authz.has_aal2()
to authenticated, service_role;

grant execute
on function authz.is_admin()
to authenticated, service_role;
