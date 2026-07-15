-- S5A-03: finalize one verified private upload into an owned Wardrobe item.

create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  owner_customer_id uuid not null references public.customer_profiles (user_id)
    on update cascade on delete cascade,
  storage_object_key text not null unique,
  category text not null,
  colour text not null,
  occasion text not null,
  season text not null,
  notes text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint wardrobe_items_category_check check (length(btrim(category)) between 1 and 80),
  constraint wardrobe_items_colour_check check (length(btrim(colour)) between 1 and 80),
  constraint wardrobe_items_occasion_check check (length(btrim(occasion)) between 1 and 80),
  constraint wardrobe_items_season_check check (length(btrim(season)) between 1 and 80),
  constraint wardrobe_items_notes_check check (notes is null or length(notes) <= 500),
  constraint wardrobe_items_status_check check (status in ('ACTIVE', 'DELETED')),
  constraint wardrobe_items_deleted_shape_check check (
    (status = 'ACTIVE' and deleted_at is null)
    or (status = 'DELETED' and deleted_at is not null)
  ),
  constraint wardrobe_items_storage_key_check check (
    storage_object_key like owner_customer_id::text || '/%'
  )
);

create index wardrobe_items_owner_idx on public.wardrobe_items (owner_customer_id);
create index wardrobe_items_status_idx on public.wardrobe_items (status);
create index wardrobe_items_created_idx on public.wardrobe_items (created_at desc, id desc);
create index wardrobe_items_owner_status_created_idx
  on public.wardrobe_items (owner_customer_id, status, created_at desc, id desc);

alter table public.wardrobe_items enable row level security;
alter table public.wardrobe_items force row level security;

create policy wardrobe_items_no_direct_access
on public.wardrobe_items
for all
to anon, authenticated
using (false)
with check (false);

-- Metadata contains the private storage key, so all direct client access is denied.
-- Owner-scoped API reads are mediated by trusted functions that omit the key.
revoke all privileges on public.wardrobe_items from public, anon, authenticated;
grant all on public.wardrobe_items to service_role;

create or replace function private.is_active_customer_actor(p_actor uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.customer_profiles customer on customer.user_id = profile.id
    where profile.id = p_actor
      and profile.account_type::text = 'CUSTOMER'
      and profile.status::text = 'ACTIVE'
  );
$$;
revoke all on function private.is_active_customer_actor(uuid) from public, anon, authenticated;

create table private.wardrobe_item_create_requests (
  customer_id uuid not null references public.customer_profiles (user_id)
    on update cascade on delete cascade,
  idempotency_key uuid not null,
  request_payload jsonb not null,
  wardrobe_item_id uuid references public.wardrobe_items (id)
    on update cascade on delete restrict,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (customer_id, idempotency_key),
  constraint wardrobe_item_create_request_payload_check
    check (jsonb_typeof(request_payload) = 'object'),
  constraint wardrobe_item_create_result_payload_check
    check (result_payload is null or jsonb_typeof(result_payload) = 'object'),
  constraint wardrobe_item_create_completion_check check (
    (wardrobe_item_id is null and result_payload is null and completed_at is null)
    or
    (wardrobe_item_id is not null and result_payload is not null and completed_at is not null)
  )
);

revoke all privileges on private.wardrobe_item_create_requests
from public, anon, authenticated, service_role;

create or replace function private.build_wardrobe_item_payload(p_item_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', item.id,
    'ownerCustomerId', item.owner_customer_id,
    'storageObjectKey', item.storage_object_key,
    'category', item.category,
    'colour', item.colour,
    'occasion', item.occasion,
    'season', item.season,
    'notes', item.notes,
    'status', item.status,
    'createdAt', item.created_at,
    'updatedAt', item.updated_at
  )
  from public.wardrobe_items item
  where item.id = p_item_id;
$$;

revoke all on function private.build_wardrobe_item_payload(uuid)
from public, anon, authenticated;
grant execute on function private.build_wardrobe_item_payload(uuid) to service_role;

create or replace function public.finalize_wardrobe_item(
  p_actor uuid,
  p_upload_id uuid,
  p_category text,
  p_colour text,
  p_occasion text,
  p_season text,
  p_notes text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_time timestamptz := statement_timestamp();
  normalized_category text := btrim(coalesce(p_category, ''));
  normalized_colour text := btrim(coalesce(p_colour, ''));
  normalized_occasion text := btrim(coalesce(p_occasion, ''));
  normalized_season text := btrim(coalesce(p_season, ''));
  normalized_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  request_payload jsonb;
  request_row private.wardrobe_item_create_requests;
  intent_row private.wardrobe_upload_intents;
  object_row record;
  item_row public.wardrobe_items;
  v_result_payload jsonb;
begin
  if p_actor is null or p_upload_id is null or p_idempotency_key is null then
    raise exception 'actor, upload, and idempotency key are required' using errcode = '22023';
  end if;

  if length(normalized_category) not between 1 and 80
    or length(normalized_colour) not between 1 and 80
    or length(normalized_occasion) not between 1 and 80
    or length(normalized_season) not between 1 and 80
    or (normalized_notes is not null and length(normalized_notes) > 500)
  then
    raise exception 'wardrobe item metadata is invalid' using errcode = '22023';
  end if;

  perform 1
  from public.profiles profile
  join public.customer_profiles customer on customer.user_id = profile.id
  where profile.id = p_actor
    and profile.account_type::text = 'CUSTOMER'
    and profile.status::text = 'ACTIVE'
  for update of customer;

  if not found then
    raise exception 'active customer access is required' using errcode = '42501';
  end if;

  request_payload := jsonb_build_object(
    'uploadId', p_upload_id,
    'category', normalized_category,
    'colour', normalized_colour,
    'occasion', normalized_occasion,
    'season', normalized_season,
    'notes', normalized_notes
  );

  insert into private.wardrobe_item_create_requests (
    customer_id, idempotency_key, request_payload
  ) values (
    p_actor, p_idempotency_key, request_payload
  )
  on conflict (customer_id, idempotency_key) do nothing
  returning * into request_row;

  if not found then
    select * into strict request_row
    from private.wardrobe_item_create_requests request
    where request.customer_id = p_actor
      and request.idempotency_key = p_idempotency_key
    for update;

    if request_row.request_payload <> request_payload then
      raise exception 'idempotency key reused with a different request' using errcode = 'P0010';
    end if;

    if request_row.result_payload is null then
      raise exception 'wardrobe finalization receipt is incomplete' using errcode = '55000';
    end if;

    return request_row.result_payload;
  end if;

  select * into intent_row
  from private.wardrobe_upload_intents intent
  where intent.id = p_upload_id
    and intent.owner_customer_id = p_actor
  for update;

  if not found
    or intent_row.expires_at <= request_time
    or intent_row.consumed_at is not null
  then
    raise exception 'wardrobe upload intent is unavailable' using errcode = 'P0021';
  end if;

  select
    object.bucket_id,
    object.name,
    object.metadata ->> 'mimetype' as mime_type,
    case when coalesce(object.metadata ->> 'size', '') ~ '^[0-9]+$'
      then (object.metadata ->> 'size')::bigint else null end as object_size
  into object_row
  from storage.objects object
  where object.bucket_id = 'wardrobe-media'
    and object.name = intent_row.storage_object_key;

  if not found
    or object_row.bucket_id <> 'wardrobe-media'
    or object_row.name <> intent_row.storage_object_key
    or object_row.mime_type is distinct from intent_row.content_type
    or object_row.object_size is distinct from intent_row.content_length::bigint
  then
    raise exception 'wardrobe upload object is missing or inconsistent' using errcode = 'P0021';
  end if;

  insert into public.wardrobe_items (
    owner_customer_id,
    storage_object_key,
    category,
    colour,
    occasion,
    season,
    notes
  ) values (
    p_actor,
    intent_row.storage_object_key,
    normalized_category,
    normalized_colour,
    normalized_occasion,
    normalized_season,
    normalized_notes
  ) returning * into item_row;

  update private.wardrobe_upload_intents intent
  set consumed_at = request_time
  where intent.id = intent_row.id;

  v_result_payload := private.build_wardrobe_item_payload(item_row.id);

  update private.wardrobe_item_create_requests request
  set wardrobe_item_id = item_row.id,
      result_payload = v_result_payload,
      completed_at = request_time
  where request.customer_id = p_actor
    and request.idempotency_key = p_idempotency_key;

  return v_result_payload;
end;
$$;

revoke all on function public.finalize_wardrobe_item(
  uuid, uuid, text, text, text, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.finalize_wardrobe_item(
  uuid, uuid, text, text, text, text, text, uuid
) to service_role;
