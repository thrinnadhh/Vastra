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

select ok(
  to_regclass('private.wardrobe_upload_intents') is not null,
  'private Wardrobe upload-intent table exists'
);

select ok(
  to_regprocedure(
    'public.create_wardrobe_upload_intent(uuid,uuid,text,integer)'
  ) is not null,
  'Wardrobe upload-intent RPC exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_wardrobe_upload_intent(uuid,uuid,text,integer)',
    'EXECUTE'
  ),
  'service role may create Wardrobe upload intents'
);

select is(
  has_table_privilege(
    'authenticated',
    'private.wardrobe_upload_intents',
    'SELECT'
  ),
  false,
  'authenticated clients cannot read private upload-intent receipts'
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
    'a2000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'wardrobe-upload-active@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'wardrobe-upload-blocked@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'a2000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'wardrobe-upload-merchant@example.test',
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
    'a2000000-0000-4000-8000-000000000001',
    'CUSTOMER',
    'Wardrobe Upload Active Customer',
    'ACTIVE'
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Wardrobe Upload Blocked Customer',
    'BLOCKED'
  ),
  (
    'a2000000-0000-4000-8000-000000000003',
    'MERCHANT',
    'Wardrobe Upload Merchant',
    'ACTIVE'
  );

insert into public.customer_profiles (user_id)
values
  ('a2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002');

set local role service_role;

select lives_ok(
  $statement$
    select public.create_wardrobe_upload_intent(
      'a2000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'image/webp',
      4096
    )
  $statement$,
  'an active customer receives a Wardrobe upload intent'
);

reset role;

select is(
  (
    select count(*)::integer
    from private.wardrobe_upload_intents
    where owner_customer_id =
      'a2000000-0000-4000-8000-000000000001'
      and idempotency_key =
        'b2000000-0000-4000-8000-000000000001'
  ),
  1,
  'one upload-intent receipt is persisted'
);

select ok(
  (
    select storage_object_key like
      'a2000000-0000-4000-8000-000000000001/%.webp'
    from private.wardrobe_upload_intents
    where owner_customer_id =
      'a2000000-0000-4000-8000-000000000001'
      and idempotency_key =
        'b2000000-0000-4000-8000-000000000001'
  ),
  'the object key is rooted in the owner UUID'
);

select is(
  (
    select storage_object_key
    from private.wardrobe_upload_intents
    where owner_customer_id =
      'a2000000-0000-4000-8000-000000000001'
      and idempotency_key =
        'b2000000-0000-4000-8000-000000000001'
  ),
  (
    select owner_customer_id::text
      || '/'
      || id::text
      || '.webp'
    from private.wardrobe_upload_intents
    where owner_customer_id =
      'a2000000-0000-4000-8000-000000000001'
      and idempotency_key =
        'b2000000-0000-4000-8000-000000000001'
  ),
  'the upload ID and strict object UUID are the same'
);

select is(
  (
    public.create_wardrobe_upload_intent(
      'a2000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'image/webp',
      4096
    )->>'uploadId'
  ),
  (
    select id::text
    from private.wardrobe_upload_intents
    where owner_customer_id =
      'a2000000-0000-4000-8000-000000000001'
      and idempotency_key =
        'b2000000-0000-4000-8000-000000000001'
  ),
  'an identical idempotent request replays the same upload ID'
);

select is(
  (
    public.create_wardrobe_upload_intent(
      'a2000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'image/webp',
      4096
    )->>'replayed'
  ),
  'true',
  'an identical request is marked as replayed internally'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      select public.create_wardrobe_upload_intent(
        'a2000000-0000-4000-8000-000000000001',
        'b2000000-0000-4000-8000-000000000001',
        'image/png',
        4096
      )
    $statement$
  ),
  'P0010',
  'an idempotency key cannot be reused with different content'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      select public.create_wardrobe_upload_intent(
        'a2000000-0000-4000-8000-000000000002',
        'b2000000-0000-4000-8000-000000000002',
        'image/jpeg',
        1024
      )
    $statement$
  ),
  '42501',
  'a blocked customer cannot create an upload intent'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      select public.create_wardrobe_upload_intent(
        'a2000000-0000-4000-8000-000000000003',
        'b2000000-0000-4000-8000-000000000003',
        'image/jpeg',
        1024
      )
    $statement$
  ),
  '42501',
  'a merchant cannot create a customer Wardrobe upload intent'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      select public.create_wardrobe_upload_intent(
        'a2000000-0000-4000-8000-000000000001',
        'b2000000-0000-4000-8000-000000000004',
        'image/gif',
        1024
      )
    $statement$
  ),
  '22023',
  'unsupported media is rejected'
);

select is(
  pg_temp.caught_sqlstate(
    $statement$
      select public.create_wardrobe_upload_intent(
        'a2000000-0000-4000-8000-000000000001',
        'b2000000-0000-4000-8000-000000000005',
        'image/jpeg',
        10485761
      )
    $statement$
  ),
  '22023',
  'oversized media is rejected'
);

select * from finish();

rollback;
