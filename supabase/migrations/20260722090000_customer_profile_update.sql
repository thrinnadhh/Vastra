-- Authenticated customer profile completion and name editing.
--
-- The RPC is security definer because profiles and customer_profiles remain
-- read-only to direct authenticated table access. Ownership, account type, and
-- active status are derived exclusively from auth.uid() and server-owned rows.

create function public.update_current_customer_profile(p_full_name text)
returns table (
  full_name text,
  profile_completed boolean,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := auth.uid();
  normalized_full_name text := regexp_replace(btrim(p_full_name), '[[:space:]]+', ' ', 'g');
  mutation_timestamp timestamptz := clock_timestamp();
  profile_updated_at timestamptz;
begin
  if current_customer_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if normalized_full_name is null
    or length(normalized_full_name) < 2
    or length(normalized_full_name) > 120
    or normalized_full_name ~ '[[:cntrl:]]'
  then
    raise exception using
      errcode = '22023',
      message = 'Customer profile input is invalid';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = current_customer_id
      and profile.account_type = 'CUSTOMER'
      and profile.status = 'ACTIVE'
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Customer profile is unavailable';
  end if;

  update public.profiles as profile
  set
    full_name = normalized_full_name,
    updated_at = mutation_timestamp
  where profile.id = current_customer_id;

  update public.customer_profiles as customer_profile
  set
    profile_completed = true,
    updated_at = mutation_timestamp
  where customer_profile.user_id = current_customer_id
  returning customer_profile.updated_at
  into profile_updated_at;

  if profile_updated_at is null then
    raise exception using
      errcode = 'P0002',
      message = 'Customer profile is unavailable';
  end if;

  return query
  select normalized_full_name, true, profile_updated_at;
end;
$$;

revoke all
on function public.update_current_customer_profile(text)
from public, anon, authenticated;

grant execute
on function public.update_current_customer_profile(text)
to authenticated;

comment on function public.update_current_customer_profile(text) is
  'Atomically updates the authenticated active customer display name and marks required profile setup complete.';
