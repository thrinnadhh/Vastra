-- S10-08: finance-admin return request decisions and disputed inspection resolution.

create table if not exists public.return_admin_decisions (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id)
    on update cascade on delete restrict,
  actor_id uuid not null references public.profiles(id)
    on update cascade on delete restrict,
  phase text not null,
  outcome text not null,
  reason_code text not null,
  note text,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint return_admin_decision_phase_check
    check (phase in ('REQUEST_REVIEW', 'INSPECTION_REVIEW')),
  constraint return_admin_decision_outcome_check
    check (outcome in ('APPROVED', 'REJECTED', 'VERIFIED')),
  constraint return_admin_decision_reason_nonempty
    check (length(btrim(reason_code)) > 0),
  constraint return_admin_decision_note_nonempty
    check (note is null or length(btrim(note)) > 0),
  constraint return_admin_decision_phase_unique
    unique (return_request_id, phase),
  constraint return_admin_decision_idempotency_unique
    unique (actor_id, idempotency_key)
);

create table if not exists public.return_admin_decision_items (
  decision_id uuid not null references public.return_admin_decisions(id)
    on update cascade on delete restrict,
  return_item_id uuid not null references public.return_items(id)
    on update cascade on delete restrict,
  approved_quantity integer not null,
  approved_refund_paise bigint not null,
  reason_code text,
  created_at timestamptz not null default now(),
  primary key (decision_id, return_item_id),
  constraint return_admin_decision_item_quantity_check
    check (approved_quantity >= 0),
  constraint return_admin_decision_item_refund_check
    check (approved_refund_paise >= 0),
  constraint return_admin_decision_item_reason_nonempty
    check (reason_code is null or length(btrim(reason_code)) > 0)
);

comment on table public.return_admin_decisions is
  'Immutable finance-admin decision for initial return review or disputed inspection.';
comment on table public.return_admin_decision_items is
  'Immutable approved quantities and refund amounts for an inspection-review decision.';

create trigger prevent_return_admin_decision_mutation
before update or delete on public.return_admin_decisions
for each row execute function private.prevent_append_only_mutation();

create trigger prevent_return_admin_decision_item_mutation
before update or delete on public.return_admin_decision_items
for each row execute function private.prevent_append_only_mutation();

alter table public.return_admin_decisions enable row level security;
alter table public.return_admin_decisions force row level security;
alter table public.return_admin_decision_items enable row level security;
alter table public.return_admin_decision_items force row level security;

revoke all privileges on public.return_admin_decisions from public, anon, authenticated;
revoke all privileges on public.return_admin_decision_items from public, anon, authenticated;
grant select, insert on public.return_admin_decisions to service_role;
grant select, insert on public.return_admin_decision_items to service_role;

create or replace function private.build_admin_return_detail(
  p_return_id uuid,
  p_replayed boolean
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'returnId', r.id,
    'returnNumber', r.return_number,
    'orderId', r.order_id,
    'customerId', r.customer_id,
    'shopId', r.shop_id,
    'reasonCode', r.reason_code,
    'customerNote', r.customer_note,
    'status', r.status,
    'refundMethod', r.refund_method,
    'requestedAt', r.requested_at,
    'approvedAt', r.approved_at,
    'completedAt', r.completed_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'returnItemId', i.id,
        'orderItemId', i.order_item_id,
        'quantity', i.quantity,
        'reasonCode', i.reason_code,
        'requestedRefundPaise', i.requested_refund_paise,
        'inspectionStatus', i.inspection_status,
        'merchantDecision', i.merchant_decision,
        'merchantNote', i.merchant_note,
        'adminApprovedQuantity', di.approved_quantity,
        'adminApprovedRefundPaise', di.approved_refund_paise,
        'adminReasonCode', di.reason_code
      ) order by i.id)
      from public.return_items i
      left join lateral (
        select x.approved_quantity, x.approved_refund_paise, x.reason_code
        from public.return_admin_decision_items x
        join public.return_admin_decisions d on d.id = x.decision_id
        where x.return_item_id = i.id
        order by d.created_at desc, d.id desc
        limit 1
      ) di on true
      where i.return_request_id = r.id
    ), '[]'::jsonb),
    'decisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'decisionId', d.id,
        'actorId', d.actor_id,
        'phase', d.phase,
        'outcome', d.outcome,
        'reasonCode', d.reason_code,
        'note', d.note,
        'createdAt', d.created_at
      ) order by d.created_at, d.id)
      from public.return_admin_decisions d
      where d.return_request_id = r.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'previousStatus', h.previous_status,
        'newStatus', h.new_status,
        'changedBy', h.changed_by,
        'reasonCode', h.reason_code,
        'note', h.note,
        'createdAt', h.created_at
      ) order by h.created_at, h.id)
      from public.return_status_history h
      where h.return_request_id = r.id
    ), '[]'::jsonb),
    'replayed', p_replayed
  )
  from public.return_requests r
  where r.id = p_return_id
$$;

create or replace function public.list_admin_returns(
  p_status text,
  p_limit integer
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
    private.build_admin_return_detail(r.id, true)
    order by r.requested_at desc, r.id
  ), '[]'::jsonb)
  from (
    select rr.id, rr.requested_at
    from public.return_requests rr
    where p_status is null or rr.status::text = p_status
    order by rr.requested_at desc, rr.id
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ) r
$$;

create or replace function public.get_admin_return(
  p_return_id uuid
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select private.build_admin_return_detail(p_return_id, true)
$$;

create or replace function public.decide_admin_return(
  p_actor_id uuid,
  p_return_id uuid,
  p_decision text,
  p_items jsonb,
  p_reason_code text,
  p_note text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt private.finance_command_receipts;
  v_return public.return_requests;
  v_phase text;
  v_outcome text;
  v_decision_id uuid := gen_random_uuid();
  v_fingerprint text;
  v_item record;
  v_input_count integer;
  v_total_approved integer := 0;
  v_total_refund bigint := 0;
  v_audit_id uuid;
  v_before_status text;
begin
  if p_actor_id is null or p_return_id is null or p_idempotency_key is null
    or p_decision not in ('APPROVE', 'REJECT', 'VERIFY')
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or nullif(btrim(p_reason_code), '') is null
    or btrim(p_reason_code) not in ('REFUND_DECISION', 'FRAUD_REVIEW', 'OTHER')
    or (p_note is not null and (length(btrim(p_note)) < 1 or length(btrim(p_note)) > 1000))
  then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;

  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;

  v_fingerprint := encode(extensions.digest(concat_ws('|',
    p_return_id::text,
    p_decision,
    p_items::text,
    btrim(p_reason_code),
    coalesce(nullif(btrim(p_note), ''), '')
  ), 'sha256'), 'hex');

  insert into private.finance_command_receipts(
    actor_id, action, idempotency_key, request_fingerprint
  ) values (
    p_actor_id, 'finance.return.decision', p_idempotency_key, v_fingerprint
  ) on conflict do nothing returning * into v_receipt;

  if not found then
    select * into strict v_receipt
    from private.finance_command_receipts
    where actor_id = p_actor_id
      and action = 'finance.return.decision'
      and idempotency_key = p_idempotency_key
    for update;
    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;
    if v_receipt.resource_id is null then
      raise exception 'FINANCE_REQUEST_INCOMPLETE';
    end if;
    return private.build_admin_return_detail(v_receipt.resource_id, true);
  end if;

  select * into v_return from public.return_requests
  where id = p_return_id for update;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;
  v_before_status := v_return.status::text;

  perform 1 from public.return_items
  where return_request_id = v_return.id
  order by id for update;

  if v_return.status = 'REQUESTED' then
    v_phase := 'REQUEST_REVIEW';
  elsif v_return.status = 'REVIEW'
    and not exists (
      select 1 from public.return_items
      where return_request_id = v_return.id and inspection_status = 'PENDING'
    )
  then
    v_phase := 'INSPECTION_REVIEW';
  else
    raise exception 'FINANCE_RETURN_STATE_CONFLICT';
  end if;

  if p_decision = 'APPROVE' then
    if v_phase <> 'REQUEST_REVIEW' or jsonb_array_length(p_items) <> 0 then
      raise exception 'FINANCE_RETURN_DECISION_CONFLICT';
    end if;
    update public.return_requests
    set status = 'REVIEW'
    where id = v_return.id and status = 'REQUESTED';
    update public.return_requests
    set status = 'APPROVED', approved_at = transaction_timestamp()
    where id = v_return.id and status = 'REVIEW';
    v_outcome := 'APPROVED';
  elsif p_decision = 'REJECT' then
    if jsonb_array_length(p_items) <> 0 then
      raise exception 'FINANCE_RETURN_DECISION_CONFLICT';
    end if;
    if v_phase = 'REQUEST_REVIEW' then
      update public.return_requests
      set status = 'REVIEW'
      where id = v_return.id and status = 'REQUESTED';
    end if;
    update public.return_requests
    set status = 'REJECTED'
    where id = v_return.id and status = 'REVIEW';
    v_outcome := 'REJECTED';
  else
    if v_phase <> 'INSPECTION_REVIEW' then
      raise exception 'FINANCE_RETURN_DECISION_CONFLICT';
    end if;
    select count(*), count(distinct item_id)
    into v_input_count, v_total_approved
    from (
      select
        (value->>'returnItemId')::uuid as item_id,
        (value->>'approvedQuantity')::integer as approved_quantity
      from jsonb_array_elements(p_items)
      where jsonb_typeof(value) = 'object'
    ) parsed;
    if v_input_count <> jsonb_array_length(p_items)
      or v_total_approved <> v_input_count
      or v_input_count <> (
        select count(*) from public.return_items
        where return_request_id = v_return.id
      )
    then
      raise exception 'FINANCE_REQUEST_INVALID';
    end if;
    v_total_approved := 0;
    for v_item in
      select
        i.id,
        i.quantity,
        i.requested_refund_paise,
        parsed.approved_quantity,
        parsed.reason_code
      from public.return_items i
      join (
        select
          (value->>'returnItemId')::uuid as return_item_id,
          (value->>'approvedQuantity')::integer as approved_quantity,
          nullif(btrim(value->>'reasonCode'), '') as reason_code
        from jsonb_array_elements(p_items)
      ) parsed on parsed.return_item_id = i.id
      where i.return_request_id = v_return.id
      order by i.id
    loop
      if v_item.approved_quantity < 0
        or v_item.approved_quantity > v_item.quantity
      then
        raise exception 'FINANCE_RETURN_DECISION_CONFLICT';
      end if;
      v_total_approved := v_total_approved + v_item.approved_quantity;
      v_total_refund := v_total_refund + round(
        v_item.requested_refund_paise::numeric
        * v_item.approved_quantity
        / v_item.quantity
      )::bigint;
    end loop;
    if v_total_approved < 1 or v_total_refund < 1 then
      raise exception 'FINANCE_RETURN_DECISION_CONFLICT';
    end if;
    update public.return_requests
    set status = 'VERIFIED'
    where id = v_return.id and status = 'REVIEW';
    v_outcome := 'VERIFIED';
  end if;

  insert into public.return_admin_decisions(
    id, return_request_id, actor_id, phase, outcome,
    reason_code, note, idempotency_key
  ) values (
    v_decision_id, v_return.id, p_actor_id, v_phase, v_outcome,
    btrim(p_reason_code), nullif(btrim(p_note), ''), p_idempotency_key
  );

  if p_decision = 'VERIFY' then
    insert into public.return_admin_decision_items(
      decision_id, return_item_id, approved_quantity,
      approved_refund_paise, reason_code
    )
    select
      v_decision_id,
      i.id,
      parsed.approved_quantity,
      round(
        i.requested_refund_paise::numeric
        * parsed.approved_quantity
        / i.quantity
      )::bigint,
      parsed.reason_code
    from public.return_items i
    join (
      select
        (value->>'returnItemId')::uuid as return_item_id,
        (value->>'approvedQuantity')::integer as approved_quantity,
        nullif(btrim(value->>'reasonCode'), '') as reason_code
      from jsonb_array_elements(p_items)
    ) parsed on parsed.return_item_id = i.id
    where i.return_request_id = v_return.id
    order by i.id;
  end if;

  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    idempotency_key, before_state, after_state
  ) values (
    p_actor_id, 'finance.return.decision', 'RETURN_REQUEST', v_return.id,
    btrim(p_reason_code), nullif(btrim(p_note), ''), p_idempotency_key,
    jsonb_build_object('status', v_before_status),
    jsonb_build_object(
      'status', (select status from public.return_requests where id = v_return.id),
      'phase', v_phase,
      'outcome', v_outcome,
      'approvedQuantity', v_total_approved,
      'approvedRefundPaise', v_total_refund
    )
  ) returning id into v_audit_id;

  update private.finance_command_receipts
  set resource_id = v_return.id, completed_at = transaction_timestamp()
  where actor_id = p_actor_id
    and action = 'finance.return.decision'
    and idempotency_key = p_idempotency_key;

  perform private.enqueue_outbox_event(
    case v_outcome
      when 'APPROVED' then 'return.approved'
      when 'REJECTED' then 'return.rejected'
      else 'return.verified'
    end,
    'RETURN_REQUEST',
    v_return.id,
    jsonb_build_object(
      'returnId', v_return.id,
      'orderId', v_return.order_id,
      'customerId', v_return.customer_id,
      'shopId', v_return.shop_id,
      'outcome', v_outcome,
      'auditId', v_audit_id
    ),
    transaction_timestamp(),
    transaction_timestamp()
  );

  return private.build_admin_return_detail(v_return.id, false);
end;
$$;

revoke all on function private.build_admin_return_detail(uuid,boolean)
  from public, anon, authenticated;
revoke all on function public.list_admin_returns(text,integer)
  from public, anon, authenticated;
revoke all on function public.get_admin_return(uuid)
  from public, anon, authenticated;
revoke all on function public.decide_admin_return(uuid,uuid,text,jsonb,text,text,uuid)
  from public, anon, authenticated;

grant execute on function private.build_admin_return_detail(uuid,boolean)
  to service_role;
grant execute on function public.list_admin_returns(text,integer)
  to service_role;
grant execute on function public.get_admin_return(uuid)
  to service_role;
grant execute on function public.decide_admin_return(uuid,uuid,text,jsonb,text,text,uuid)
  to service_role;
