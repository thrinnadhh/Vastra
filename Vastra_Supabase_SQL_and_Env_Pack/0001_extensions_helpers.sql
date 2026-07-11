-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.

create extension if not exists pgcrypto;
create extension if not exists postgis;
create extension if not exists citext;
create extension if not exists pg_trgm;
create extension if not exists vector;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- updated_at helper
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Self-registration is always CUSTOMER. Merchant, captain and admin elevation must
-- happen through trusted backend/admin workflows, never raw_user_meta_data.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, account_type, full_name, phone_number, email)
  values (
    new.id,
    'CUSTOMER',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();
