insert into storage.buckets(
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'return-evidence',
  'return-evidence',
  false,
  15728640,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.return_evidence
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint;

alter table public.return_evidence
  drop constraint if exists return_evidence_mime_type_check,
  add constraint return_evidence_mime_type_check check (
    mime_type is null or mime_type in (
      'image/jpeg','image/png','image/webp','video/mp4','application/pdf'
    )
  ),
  drop constraint if exists return_evidence_size_check,
  add constraint return_evidence_size_check check (
    size_bytes is null or size_bytes between 1 and 15728640
  );

create table if not exists private.return_evidence_upload_intents (
  id uuid primary key,
  return_request_id uuid not null references public.return_requests(id),
  actor_id uuid not null references public.profiles(id),
  object_key text not null unique,
  evidence_type public.return_evidence_type not null,
  mime_type text not null,
  size_bytes bigint not null,
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint return_evidence_intent_object_key_nonempty check (
    length(btrim(object_key)) > 0 and position('..' in object_key) = 0
  ),
  constraint return_evidence_intent_mime_type check (
    mime_type in ('image/jpeg','image/png','image/webp','video/mp4','application/pdf')
  ),
  constraint return_evidence_intent_size check (size_bytes between 1 and 15728640),
  constraint return_evidence_intent_expiry check (expires_at > created_at),
  constraint return_evidence_intent_finalized check (
    finalized_at is null or finalized_at >= created_at
  )
);

revoke all on private.return_evidence_upload_intents from public, anon, authenticated;
grant select, insert, update on private.return_evidence_upload_intents to service_role;

create unique index if not exists delivery_tasks_one_active_return_pickup_idx
  on public.delivery_tasks(return_request_id)
  where task_type = 'RETURN_PICKUP'
    and status not in ('COMPLETED','FAILED','CANCELLED');

create or replace function public.create_customer_return_evidence_intent(
  p_actor_id uuid,
  p_return_id uuid,
  p_intent_id uuid,
  p_object_key text,
  p_evidence_type text,
  p_mime_type text,
  p_size_bytes bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_return public.return_requests;
  v_type public.return_evidence_type;
  v_intent private.return_evidence_upload_intents;
  v_prefix text;
begin
  if p_actor_id is null or p_return_id is null or p_intent_id is null
    or nullif(btrim(p_object_key), '') is null
    or position('..' in p_object_key) > 0
    or p_size_bytes not between 1 and 15728640 then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  select * into v_return from public.return_requests
  where id = p_return_id and customer_id = p_actor_id for update;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;
  if v_return.status not in ('REQUESTED','REVIEW','APPROVED','PICKUP_ASSIGNED') then
    raise exception 'FINANCE_RETURN_STATE_CONFLICT';
  end if;
  begin
    v_type := p_evidence_type::public.return_evidence_type;
  exception when invalid_text_representation then
    raise exception 'FINANCE_REQUEST_INVALID';
  end;
  if v_type not in ('CUSTOMER_PHOTO','VIDEO','DOCUMENT')
    or p_mime_type not in (
      'image/jpeg','image/png','image/webp','video/mp4','application/pdf'
    )
    or (v_type = 'CUSTOMER_PHOTO' and p_mime_type not like 'image/%')
    or (v_type = 'VIDEO' and p_mime_type <> 'video/mp4')
    or (v_type = 'DOCUMENT' and p_mime_type <> 'application/pdf') then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  v_prefix := format('returns/%s/%s/', p_return_id, p_actor_id);
  if p_object_key not like v_prefix || '%' or right(p_object_key, 1) = '/' then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  insert into private.return_evidence_upload_intents(
    id, return_request_id, actor_id, object_key, evidence_type,
    mime_type, size_bytes, expires_at
  ) values (
    p_intent_id, p_return_id, p_actor_id, p_object_key, v_type,
    p_mime_type, p_size_bytes, transaction_timestamp() + interval '10 minutes'
  ) returning * into v_intent;
  return jsonb_build_object(
    'intentId', v_intent.id,
    'returnId', v_intent.return_request_id,
    'objectKey', v_intent.object_key,
    'evidenceType', v_intent.evidence_type,
    'mimeType', v_intent.mime_type,
    'sizeBytes', v_intent.size_bytes,
    'expiresAt', v_intent.expires_at
  );
end;
$$;

create or replace function public.finalize_customer_return_evidence(
  p_actor_id uuid,
  p_return_id uuid,
  p_object_key text,
  p_description text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_return public.return_requests;
  v_intent private.return_evidence_upload_intents;
  v_evidence public.return_evidence;
begin
  select * into v_return from public.return_requests
  where id = p_return_id and customer_id = p_actor_id for update;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;
  if v_return.status not in ('REQUESTED','REVIEW','APPROVED','PICKUP_ASSIGNED') then
    raise exception 'FINANCE_RETURN_STATE_CONFLICT';
  end if;
  select * into v_intent from private.return_evidence_upload_intents
  where return_request_id = p_return_id and actor_id = p_actor_id
    and object_key = p_object_key for update;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;
  if v_intent.finalized_at is not null
    or v_intent.expires_at <= transaction_timestamp() then
    raise exception 'FINANCE_RETURN_STATE_CONFLICT';
  end if;
  insert into public.return_evidence(
    return_request_id, uploaded_by, evidence_type, storage_object_key,
    description, mime_type, size_bytes
  ) values (
    p_return_id, p_actor_id, v_intent.evidence_type, v_intent.object_key,
    nullif(btrim(p_description), ''), v_intent.mime_type, v_intent.size_bytes
  ) returning * into v_evidence;
  update private.return_evidence_upload_intents
  set finalized_at = transaction_timestamp() where id = v_intent.id;
  return jsonb_build_object(
    'evidenceId', v_evidence.id,
    'returnId', v_evidence.return_request_id,
    'evidenceType', v_evidence.evidence_type,
    'objectKey', v_evidence.storage_object_key,
    'mimeType', v_evidence.mime_type,
    'sizeBytes', v_evidence.size_bytes,
    'description', v_evidence.description,
    'createdAt', v_evidence.created_at
  );
end;
$$;

create or replace function public.get_customer_return_evidence_object(
  p_actor_id uuid,
  p_return_id uuid,
  p_evidence_id uuid
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'evidenceId', e.id,
    'objectKey', e.storage_object_key
  )
  from public.return_evidence e
  join public.return_requests r on r.id = e.return_request_id
  where r.id = p_return_id and r.customer_id = p_actor_id
    and e.id = p_evidence_id and e.storage_object_key is not null
$$;

create or replace function public.admin_assign_return_pickup(
  p_actor_id uuid,
  p_return_id uuid,
  p_scheduled_at timestamptz,
  p_reason_code text,
  p_note text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt private.admin_command_receipts;
  v_return public.return_requests;
  v_order public.orders;
  v_shop public.shops;
  v_shop_address public.addresses;
  v_task public.delivery_tasks;
  v_audit_id uuid;
  v_fingerprint text;
  v_result jsonb;
  v_pickup_location extensions.geography(point, 4326);
begin
  if p_actor_id is null or p_return_id is null or p_idempotency_key is null
    or p_reason_code <> 'RETURN_LOGISTICS' then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;
  v_fingerprint := encode(extensions.digest(concat_ws('|',
    p_return_id::text,
    coalesce(p_scheduled_at::text, ''),
    p_reason_code,
    coalesce(nullif(btrim(p_note), ''), '')
  ), 'sha256'), 'hex');
  insert into private.admin_command_receipts(
    actor_id, action, idempotency_key, request_fingerprint
  ) values (
    p_actor_id, 'finance.return.assign_pickup', p_idempotency_key, v_fingerprint
  ) on conflict do nothing returning * into v_receipt;
  if not found then
    select * into strict v_receipt from private.admin_command_receipts
    where actor_id = p_actor_id and action = 'finance.return.assign_pickup'
      and idempotency_key = p_idempotency_key for update;
    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;
    if v_receipt.audit_id is null or v_receipt.result_payload is null then
      raise exception 'FINANCE_REQUEST_INCOMPLETE';
    end if;
    return v_receipt.result_payload || jsonb_build_object('replayed', true);
  end if;

  select * into v_return from public.return_requests
  where id = p_return_id for update;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;
  if v_return.status <> 'APPROVED' then raise exception 'FINANCE_RETURN_STATE_CONFLICT'; end if;
  select * into strict v_order from public.orders where id = v_return.order_id for update;
  select * into strict v_shop from public.shops where id = v_return.shop_id for update;
  select * into strict v_shop_address from public.addresses
  where id = v_shop.address_id for update;
  if exists (
    select 1 from public.delivery_tasks
    where return_request_id = v_return.id and task_type = 'RETURN_PICKUP'
      and status not in ('COMPLETED','FAILED','CANCELLED')
  ) then raise exception 'FINANCE_RETURN_STATE_CONFLICT'; end if;
  begin
    v_pickup_location := extensions.st_setsrid(extensions.st_makepoint(
      (v_order.address_snapshot->>'longitude')::double precision,
      (v_order.address_snapshot->>'latitude')::double precision
    ), 4326)::extensions.geography;
  exception when others then
    raise exception 'FINANCE_RETURN_STATE_CONFLICT';
  end;
  insert into public.delivery_tasks(
    order_id, return_request_id, task_type, pickup_shop_id,
    pickup_address_snapshot, drop_address_snapshot,
    pickup_location, drop_location, status,
    estimated_distance_meters, delivery_fee_paise,
    captain_earning_paise, scheduled_at
  ) values (
    v_order.id, v_return.id, 'RETURN_PICKUP', v_shop.id,
    v_order.address_snapshot,
    jsonb_build_object(
      'id', v_shop_address.id, 'label', v_shop_address.label,
      'recipientName', v_shop_address.recipient_name,
      'phoneNumber', v_shop_address.phone_number,
      'line1', v_shop_address.line1, 'line2', v_shop_address.line2,
      'landmark', v_shop_address.landmark, 'area', v_shop_address.area,
      'city', v_shop_address.city, 'state', v_shop_address.state,
      'postalCode', v_shop_address.postal_code,
      'countryCode', v_shop_address.country_code,
      'latitude', extensions.st_y(v_shop_address.location::extensions.geometry),
      'longitude', extensions.st_x(v_shop_address.location::extensions.geometry)
    ),
    v_pickup_location, v_shop.location, 'CREATED',
    round(extensions.st_distance(v_pickup_location, v_shop.location))::integer,
    0, 0, coalesce(p_scheduled_at, transaction_timestamp())
  ) returning * into v_task;
  update public.return_requests
  set status = 'PICKUP_ASSIGNED', updated_at = transaction_timestamp()
  where id = v_return.id;
  v_result := jsonb_build_object(
    'returnId', v_return.id,
    'deliveryTaskId', v_task.id,
    'taskType', v_task.task_type,
    'taskStatus', v_task.status,
    'returnStatus', 'PICKUP_ASSIGNED',
    'scheduledAt', v_task.scheduled_at,
    'replayed', false
  );
  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    idempotency_key, before_state, after_state
  ) values (
    p_actor_id, 'finance.return.assign_pickup', 'RETURN_REQUEST', v_return.id,
    p_reason_code, nullif(btrim(p_note), ''), p_idempotency_key,
    jsonb_build_object('status', v_return.status),
    jsonb_build_object(
      'status', 'PICKUP_ASSIGNED', 'deliveryTaskId', v_task.id,
      'scheduledAt', v_task.scheduled_at
    )
  ) returning id into v_audit_id;
  update private.admin_command_receipts
  set audit_id = v_audit_id, result_payload = v_result,
      completed_at = transaction_timestamp()
  where actor_id = p_actor_id and action = 'finance.return.assign_pickup'
    and idempotency_key = p_idempotency_key;
  perform private.enqueue_outbox_event(
    'return.pickup.created', 'DELIVERY_TASK', v_task.id,
    jsonb_build_object(
      'returnId', v_return.id, 'deliveryTaskId', v_task.id,
      'orderId', v_order.id, 'shopId', v_shop.id,
      'scheduledAt', v_task.scheduled_at
    ), transaction_timestamp(), transaction_timestamp()
  );
  return v_result;
end;
$$;

revoke all on function public.create_customer_return_evidence_intent(
  uuid,uuid,uuid,text,text,text,bigint
) from public, anon, authenticated;
revoke all on function public.finalize_customer_return_evidence(uuid,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.get_customer_return_evidence_object(uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.admin_assign_return_pickup(
  uuid,uuid,timestamptz,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.create_customer_return_evidence_intent(
  uuid,uuid,uuid,text,text,text,bigint
) to service_role;
grant execute on function public.finalize_customer_return_evidence(uuid,uuid,text,text)
  to service_role;
grant execute on function public.get_customer_return_evidence_object(uuid,uuid,uuid)
  to service_role;
grant execute on function public.admin_assign_return_pickup(
  uuid,uuid,timestamptz,text,text,uuid
) to service_role;
