create schema if not exists private;

create table if not exists private.admin_command_receipts (
  actor_id uuid not null references public.profiles(id),
  action text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  audit_id uuid,
  created_at timestamptz not null default now(),
  primary key (actor_id, action, idempotency_key)
);

create table if not exists private.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null check (length(action) between 3 and 120),
  resource_type text not null check (resource_type in ('ORDER','DELIVERY_TASK','MERCHANT','CAPTAIN','CASE','CONFIGURATION')),
  resource_id uuid not null,
  reason_code text not null check (reason_code in ('CUSTOMER_REQUEST','MERCHANT_REQUEST','CAPTAIN_REQUEST','DELIVERY_FAILURE','PAYMENT_RISK','FRAUD_RISK','POLICY_VIOLATION','SAFETY_INCIDENT','OPERATIONAL_RECOVERY','DATA_CORRECTION','OTHER')),
  note text check (note is null or length(note) between 1 and 1000),
  request_id text,
  idempotency_key uuid not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_resource_idx
  on private.admin_audit_log(resource_type, resource_id, created_at desc);
create index if not exists admin_audit_actor_idx
  on private.admin_audit_log(actor_id, created_at desc);

alter table private.admin_command_receipts enable row level security;
alter table private.admin_audit_log enable row level security;

revoke all on private.admin_command_receipts from anon, authenticated;
revoke all on private.admin_audit_log from anon, authenticated;
grant select, insert, update on private.admin_command_receipts to service_role;
grant select, insert on private.admin_audit_log to service_role;

create or replace function public.record_admin_audit(
  p_actor_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid,
  p_before_state jsonb,
  p_after_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_fingerprint text;
  v_receipt private.admin_command_receipts%rowtype;
  v_audit private.admin_audit_log%rowtype;
begin
  if p_actor_id is null or p_resource_id is null or p_idempotency_key is null then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;

  v_fingerprint := encode(digest(concat_ws('|', p_resource_type, p_resource_id::text, p_reason_code, coalesce(p_note,''), coalesce(p_before_state,'null'::jsonb)::text, coalesce(p_after_state,'null'::jsonb)::text), 'sha256'), 'hex');

  insert into private.admin_command_receipts(actor_id, action, idempotency_key, request_fingerprint)
  values (p_actor_id, p_action, p_idempotency_key, v_fingerprint)
  on conflict do nothing;

  select * into v_receipt
  from private.admin_command_receipts
  where actor_id = p_actor_id and action = p_action and idempotency_key = p_idempotency_key
  for update;

  if v_receipt.request_fingerprint <> v_fingerprint then
    raise exception 'ADMIN_IDEMPOTENCY_CONFLICT';
  end if;

  if v_receipt.audit_id is not null then
    select * into v_audit from private.admin_audit_log where id = v_receipt.audit_id;
    return to_jsonb(v_audit);
  end if;

  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note, request_id,
    idempotency_key, before_state, after_state
  ) values (
    p_actor_id, p_action, p_resource_type, p_resource_id, p_reason_code, nullif(trim(p_note),''),
    nullif(trim(p_request_id),''), p_idempotency_key, p_before_state, p_after_state
  ) returning * into v_audit;

  update private.admin_command_receipts
  set audit_id = v_audit.id
  where actor_id = p_actor_id and action = p_action and idempotency_key = p_idempotency_key;

  return to_jsonb(v_audit);
end;
$$;

create or replace function public.list_admin_audit(
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_actor_id uuid default null,
  p_limit integer default 50
) returns setof jsonb
language sql
security definer
set search_path = public, private
stable
as $$
  select to_jsonb(a)
  from private.admin_audit_log a
  where (p_resource_type is null or a.resource_type = p_resource_type)
    and (p_resource_id is null or a.resource_id = p_resource_id)
    and (p_actor_id is null or a.actor_id = p_actor_id)
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

revoke all on function public.record_admin_audit(uuid,text,text,uuid,text,text,text,uuid,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.list_admin_audit(text,uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.record_admin_audit(uuid,text,text,uuid,text,text,text,uuid,jsonb,jsonb) to service_role;
grant execute on function public.list_admin_audit(text,uuid,uuid,integer) to service_role;
