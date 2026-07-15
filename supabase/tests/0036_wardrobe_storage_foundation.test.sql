begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select no_plan();

create or replace function pg_temp.caught_sqlstate(
  p_statement text
)
returns text
language plpgsql
as $$
begin
  execute p_statement;
  return null;
exception
  when others then
    return sqlstate;
end;
$$;

create or replace function pg_temp.affected_rows(
  p_statement text
)
returns integer
language plpgsql
as $$
declare
  affected_count integer;
begin
  execute p_statement;
  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

select ok(
  to_regprocedure('authz.is_active_customer()') is not null,
  'active-customer storage predicate exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'authz.is_active_customer()',
    'EXECUTE'
  ),
  'authenticated users may invoke the active-customer predicate'
);

select is(
  (
    select count(*)::integer
    from storage.buckets
    where id = 'wardrobe-media'
  ),
  1,
  'Wardrobe media bucket exists'
);

select is(
  (
    select public
    from storage.buckets
    where id = 'wardrobe-media'
  ),
  false,
  'Wardrobe media bucket is private'
);

select is(
  (
    select file_size_limit::bigint
    from storage.buckets
    where id = 'wardrobe-media'
  ),
  10485760::bigint,
  'Wardrobe media objects are limited to ten megabytes'
);

select is(
  (
    select allowed_mime_types
    from storage.buckets
    where id = 'wardrobe-media'
  ),
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[],
  'Wardrobe media accepts only supported image MIME types'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'wardrobe_media_owner_insert',
        'wardrobe_media_owner_select',
        'wardrobe_media_owner_update',
        'wardrobe_media_owner_delete'
      )
  ),
  1,
  'Wardrobe media exposes only the intent-gated upload policy'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'wardrobe-customer-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'wardrobe-customer-two@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'wardrobe-blocked-customer@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'wardrobe-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (
  id,
  account_type,
  full_name,
  status
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'CUSTOMER',
    'Wardrobe Customer One',
    'ACTIVE'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Wardrobe Customer Two',
    'ACTIVE'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'CUSTOMER',
    'Wardrobe Blocked Customer',
    'BLOCKED'
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'MERCHANT',
    'Wardrobe Merchant',
    'ACTIVE'
  );

insert into public.customer_profiles (user_id)
values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000003');

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'a1000000-0000-4000-8000-000000000004',
  'Wardrobe Merchant Legal'
);

insert into private.wardrobe_upload_intents (
  id,
  owner_customer_id,
  idempotency_key,
  content_type,
  content_length,
  storage_object_key,
  expires_at
)
values (
  'b2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'image/jpeg',
  1024,
  'a1000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000001.jpg',
  statement_timestamp() + interval '2 hours'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001',
  true
);

select ok(
  authz.is_active_customer(),
  'an active customer satisfies the Wardrobe storage predicate'
);

select lives_ok(
  $statement$
    insert into storage.objects (
      bucket_id,
      name,
      owner_id
    )
    values (
      'wardrobe-media',
      'a1000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000001.jpg',
      'a1000000-0000-4000-8000-000000000001'
    )
  $statement$,
  'an active customer may insert a valid object in their own folder'
);

select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'wardrobe-media'
      and name =
        'a1000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000001.jpg'
  ),
  0,
  'the owner cannot directly read private Wardrobe storage metadata'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      insert into storage.objects (
        bucket_id,
        name,
        owner_id
      )
      values (
        'wardrobe-media',
        'a1000000-0000-4000-8000-000000000001/nested/b2000000-0000-4000-8000-000000000002.png',
        'a1000000-0000-4000-8000-000000000001'
      )
    $statement$
  ),
  '42501',
  'nested object paths are rejected'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      insert into storage.objects (
        bucket_id,
        name,
        owner_id
      )
      values (
        'wardrobe-media',
        'a1000000-0000-4000-8000-000000000001/not-a-uuid.gif',
        'a1000000-0000-4000-8000-000000000001'
      )
    $statement$
  ),
  '42501',
  'invalid filenames and unsupported extensions are rejected'
);

select is(
  pg_temp.affected_rows(
    $statement$
      update storage.objects
      set name =
        'a1000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000002.webp'
      where bucket_id = 'wardrobe-media'
        and name =
          'a1000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000001.jpg'
    $statement$
  ),
  0,
  'the owner cannot directly rename a finalized Wardrobe object'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000002',
  true
);

select ok(
  authz.is_active_customer(),
  'a second active customer satisfies the storage predicate'
);

select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'wardrobe-media'
      and name like
        'a1000000-0000-4000-8000-000000000001/%'
  ),
  0,
  'another customer cannot read the owner private objects'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      insert into storage.objects (
        bucket_id,
        name,
        owner_id
      )
      values (
        'wardrobe-media',
        'a1000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000003.png',
        'a1000000-0000-4000-8000-000000000002'
      )
    $statement$
  ),
  '42501',
  'another customer cannot insert into the owner folder'
);

select is(
  pg_temp.affected_rows(
    $statement$
      update storage.objects
      set name =
        'a1000000-0000-4000-8000-000000000002/b2000000-0000-4000-8000-000000000004.png'
      where bucket_id = 'wardrobe-media'
        and name =
          'a1000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000002.webp'
    $statement$
  ),
  0,
  'another customer cannot move or update the owner object'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000003',
  true
);

select ok(
  not authz.is_active_customer(),
  'a blocked customer does not satisfy the storage predicate'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      insert into storage.objects (
        bucket_id,
        name,
        owner_id
      )
      values (
        'wardrobe-media',
        'a1000000-0000-4000-8000-000000000003/b2000000-0000-4000-8000-000000000005.jpeg',
        'a1000000-0000-4000-8000-000000000003'
      )
    $statement$
  ),
  '42501',
  'a blocked customer cannot upload Wardrobe media'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000004',
  true
);

select ok(
  not authz.is_active_customer(),
  'a merchant does not satisfy the customer storage predicate'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      insert into storage.objects (
        bucket_id,
        name,
        owner_id
      )
      values (
        'wardrobe-media',
        'a1000000-0000-4000-8000-000000000004/b2000000-0000-4000-8000-000000000006.png',
        'a1000000-0000-4000-8000-000000000004'
      )
    $statement$
  ),
  '42501',
  'a merchant cannot upload Wardrobe media'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001',
  true
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'wardrobe_media_owner_select',
        'wardrobe_media_owner_update',
        'wardrobe_media_owner_delete'
      )
  ),
  'authenticated customers cannot directly read, update, or delete Wardrobe media'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'wardrobe_media_owner_insert'
      and cmd = 'INSERT'
      and 'authenticated' = any(roles)
      and with_check ~ 'can_upload_wardrobe_object'
  ),
  'Wardrobe uploads require a live owner-scoped upload intent'
);

reset role;
set local role anon;

select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'wardrobe-media'
  ),
  0,
  'anonymous users cannot read private Wardrobe objects'
);

reset role;

select * from finish();

rollback;
