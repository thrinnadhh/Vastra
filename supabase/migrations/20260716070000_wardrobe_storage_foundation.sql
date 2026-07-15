-- S5A-01: private Wardrobe storage foundation.
--
-- This migration provisions an image-only private bucket and restricts every
-- client operation to active customers using a strict owner-scoped object key:
--
--   <customer-user-uuid>/<object-uuid>.<jpg|jpeg|png|webp>
--
-- Forward-fix strategy:
-- - Change limits, MIME types, or policy rules in a later ordered migration.
-- - Do not rewrite this migration after it has been applied outside local use.

create or replace function authz.is_active_customer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.customer_profiles cp
      on cp.user_id = p.id
    where p.id = auth.uid()
      and p.account_type::text = 'CUSTOMER'
      and p.status::text = 'ACTIVE'
  );
$$;

revoke all
on function authz.is_active_customer()
from public;

grant execute
on function authz.is_active_customer()
to authenticated, service_role;

comment on function authz.is_active_customer() is
  'Returns true only for the authenticated active customer profile used by owner-scoped Wardrobe storage policies.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'wardrobe-media',
  'wardrobe-media',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- INSERT: only an active customer may create a valid object under their own
-- first and only folder segment.
drop policy if exists wardrobe_media_owner_insert
on storage.objects;

create policy wardrobe_media_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'wardrobe-media'
  and (select authz.is_active_customer())
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.filename(name)) ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);

-- SELECT: private object metadata is visible only to the active customer whose
-- UUID is the first folder segment. Supabase Storage still requires signed URLs
-- for private media delivery.
drop policy if exists wardrobe_media_owner_select
on storage.objects;

create policy wardrobe_media_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'wardrobe-media'
  and (select authz.is_active_customer())
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.filename(name)) ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);

-- UPDATE: owners may rename or replace only within their own valid key space.
drop policy if exists wardrobe_media_owner_update
on storage.objects;

create policy wardrobe_media_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'wardrobe-media'
  and (select authz.is_active_customer())
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.filename(name)) ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
)
with check (
  bucket_id = 'wardrobe-media'
  and (select authz.is_active_customer())
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.filename(name)) ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);

-- DELETE: owners may remove only objects inside their own Wardrobe key space.
drop policy if exists wardrobe_media_owner_delete
on storage.objects;

create policy wardrobe_media_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'wardrobe-media'
  and (select authz.is_active_customer())
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.filename(name)) ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);
