-- S5A-02: persistent, owner-scoped Wardrobe upload intents.
--
-- The upload intent is backend-only state. It maps the public uploadId used by
-- the later Wardrobe item-finalization flow to one strict private object key.
-- Reusing an idempotency key with the same request safely replays the intent;
-- changing the request or retrying after expiry requires a new key.

create table private.wardrobe_upload_intents (
  id uuid primary key,
  owner_customer_id uuid not null,
  idempotency_key uuid not null,
  content_type text not null,
  content_length integer not null,
  storage_object_key text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint wardrobe_upload_intents_owner_fkey
    foreign key (owner_customer_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint wardrobe_upload_intents_owner_idempotency_key
    unique (owner_customer_id, idempotency_key),

  constraint wardrobe_upload_intents_storage_object_key_key
    unique (storage_object_key),

  constraint wardrobe_upload_intents_content_type_check
    check (content_type in ('image/jpeg', 'image/png', 'image/webp')),

  constraint wardrobe_upload_intents_content_length_check
    check (content_length between 1 and 10485760),

  constraint wardrobe_upload_intents_expiry_check
    check (expires_at > created_at),

  constraint wardrobe_upload_intents_consumed_check
    check (consumed_at is null or consumed_at >= created_at),

  constraint wardrobe_upload_intents_object_key_check
    check (
      storage_object_key =
        owner_customer_id::text
        || '/'
        || id::text
        || case content_type
          when 'image/jpeg' then '.jpg'
          when 'image/png' then '.png'
          when 'image/webp' then '.webp'
        end
    )
);

comment on table private.wardrobe_upload_intents is
  'Backend-only receipts for private customer Wardrobe media uploads.';

revoke all privileges
on table private.wardrobe_upload_intents
from public, anon, authenticated, service_role;

create index wardrobe_upload_intents_owner_created_idx
on private.wardrobe_upload_intents (
  owner_customer_id,
  created_at desc
);

create index wardrobe_upload_intents_expiry_idx
on private.wardrobe_upload_intents (expires_at)
where consumed_at is null;

create or replace function public.create_wardrobe_upload_intent(
  p_actor uuid,
  p_idempotency_key uuid,
  p_content_type text,
  p_content_length integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_time timestamptz := statement_timestamp();
  upload_id uuid := gen_random_uuid();
  file_extension text;
  object_key text;
  intent_row private.wardrobe_upload_intents;
begin
  if p_actor is null or p_idempotency_key is null then
    raise exception
      'actor and idempotency key are required'
      using errcode = '22023';
  end if;

  if p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception
      'unsupported Wardrobe media content type'
      using errcode = '22023';
  end if;

  if p_content_length is null
    or p_content_length < 1
    or p_content_length > 10485760
  then
    raise exception
      'Wardrobe media content length is invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.profiles profile
  join public.customer_profiles customer
    on customer.user_id = profile.id
  where profile.id = p_actor
    and profile.account_type::text = 'CUSTOMER'
    and profile.status::text = 'ACTIVE';

  if not found then
    raise exception
      'active customer access is required'
      using errcode = '42501';
  end if;

  file_extension :=
    case p_content_type
      when 'image/jpeg' then 'jpg'
      when 'image/png' then 'png'
      when 'image/webp' then 'webp'
    end;

  object_key :=
    p_actor::text
    || '/'
    || upload_id::text
    || '.'
    || file_extension;

  insert into private.wardrobe_upload_intents (
    id,
    owner_customer_id,
    idempotency_key,
    content_type,
    content_length,
    storage_object_key,
    expires_at,
    created_at
  )
  values (
    upload_id,
    p_actor,
    p_idempotency_key,
    p_content_type,
    p_content_length,
    object_key,
    request_time + interval '2 hours',
    request_time
  )
  on conflict (owner_customer_id, idempotency_key) do nothing
  returning *
  into intent_row;

  if not found then
    select *
    into strict intent_row
    from private.wardrobe_upload_intents intent
    where intent.owner_customer_id = p_actor
      and intent.idempotency_key = p_idempotency_key
    for update;

    if intent_row.content_type <> p_content_type
      or intent_row.content_length <> p_content_length
      or intent_row.expires_at <= request_time
      or intent_row.consumed_at is not null
    then
      raise exception
        'idempotency key reused for a different or unavailable upload intent'
        using errcode = 'P0010';
    end if;

    return jsonb_build_object(
      'uploadId', intent_row.id,
      'objectKey', intent_row.storage_object_key,
      'expiresAt', intent_row.expires_at,
      'replayed', true
    );
  end if;

  return jsonb_build_object(
    'uploadId', intent_row.id,
    'objectKey', intent_row.storage_object_key,
    'expiresAt', intent_row.expires_at,
    'replayed', false
  );
end;
$$;

revoke all
on function public.create_wardrobe_upload_intent(
  uuid,
  uuid,
  text,
  integer
)
from public, anon, authenticated;

grant execute
on function public.create_wardrobe_upload_intent(
  uuid,
  uuid,
  text,
  integer
)
to service_role;

comment on function public.create_wardrobe_upload_intent(
  uuid,
  uuid,
  text,
  integer
) is
  'Creates or safely replays a two-hour private Wardrobe media upload intent for one active customer.';
