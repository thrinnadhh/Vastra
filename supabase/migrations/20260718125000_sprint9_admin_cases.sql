alter table public.support_tickets
  add column if not exists merchant_id uuid references public.merchant_profiles(user_id),
  add column if not exists captain_id uuid references public.captain_profiles(user_id),
  add column if not exists escalated_at timestamptz,
  add column if not exists version integer not null default 1;

create index if not exists support_tickets_merchant_idx
  on public.support_tickets(merchant_id, created_at desc)
  where merchant_id is not null;
create index if not exists support_tickets_captain_idx
  on public.support_tickets(captain_id, created_at desc)
  where captain_id is not null;

create table if not exists private.admin_case_history (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.support_tickets(id),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  previous_status public.support_ticket_status,
  new_status public.support_ticket_status not null,
  reason_code text not null,
  note text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_case_history_details_object check (jsonb_typeof(details) = 'object')
);

alter table private.admin_case_history enable row level security;
revoke all on private.admin_case_history from public, anon, authenticated;
grant select, insert on private.admin_case_history to service_role;
create index if not exists admin_case_history_case_idx
  on private.admin_case_history(case_id, created_at, id);

drop trigger if exists prevent_admin_case_history_mutation
  on private.admin_case_history;
create trigger prevent_admin_case_history_mutation
before update or delete on private.admin_case_history
for each row execute function private.prevent_append_only_mutation();

create or replace function public.get_admin_case(p_case_id uuid)
returns jsonb
language sql
security definer
set search_path = public, private
stable
as $$
  select jsonb_build_object(
    'case', jsonb_build_object(
      'id', t.id,
      'caseNumber', t.ticket_number,
      'category', t.category,
      'priority', t.priority,
      'status', t.status,
      'subject', t.subject,
      'description', t.description,
      'orderId', t.order_id,
      'shopId', t.shop_id,
      'deliveryTaskId', t.delivery_task_id,
      'returnRequestId', t.return_request_id,
      'merchantId', t.merchant_id,
      'captainId', t.captain_id,
      'assignedTeam', t.assigned_team,
      'assignedTo', t.assigned_to,
      'resolutionCode', t.resolution_code,
      'resolutionNote', t.resolution_note,
      'firstResponseAt', t.first_response_at,
      'escalatedAt', t.escalated_at,
      'resolvedAt', t.resolved_at,
      'closedAt', t.closed_at,
      'version', t.version,
      'createdAt', t.created_at,
      'updatedAt', t.updated_at
    ),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'senderId', m.sender_id,
        'messageType', m.message_type,
        'message', m.message,
        'attachmentObjectKey', m.attachment_object_key,
        'internalNote', m.is_internal_note,
        'createdAt', m.created_at
      ) order by m.created_at, m.id)
      from public.support_messages m where m.ticket_id = t.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'actorId', h.actor_id,
        'action', h.action,
        'previousStatus', h.previous_status,
        'newStatus', h.new_status,
        'reasonCode', h.reason_code,
        'note', h.note,
        'details', h.details,
        'createdAt', h.created_at
      ) order by h.created_at, h.id)
      from private.admin_case_history h where h.case_id = t.id
    ), '[]'::jsonb)
  )
  from public.support_tickets t
  where t.id = p_case_id
$$;

create or replace function public.list_admin_cases(
  p_status text default null,
  p_priority text default null,
  p_assigned_to uuid default null,
  p_limit integer default 50
) returns setof jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', t.id,
    'caseNumber', t.ticket_number,
    'category', t.category,
    'priority', t.priority,
    'status', t.status,
    'subject', t.subject,
    'orderId', t.order_id,
    'shopId', t.shop_id,
    'deliveryTaskId', t.delivery_task_id,
    'merchantId', t.merchant_id,
    'captainId', t.captain_id,
    'assignedTeam', t.assigned_team,
    'assignedTo', t.assigned_to,
    'escalatedAt', t.escalated_at,
    'createdAt', t.created_at,
    'updatedAt', t.updated_at
  )
  from public.support_tickets t
  where (p_status is null or t.status::text = p_status)
    and (p_priority is null or t.priority::text = p_priority)
    and (p_assigned_to is null or t.assigned_to = p_assigned_to)
  order by
    case t.priority when 'URGENT' then 1 when 'HIGH' then 2 when 'MEDIUM' then 3 else 4 end,
    t.updated_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

create or replace function private.claim_admin_case_command(
  p_actor_id uuid,
  p_action text,
  p_idempotency_key uuid,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_receipt private.admin_command_receipts%rowtype;
  v_case_id uuid;
begin
  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'ADMIN_ACCESS_DENIED'; end if;
  if p_idempotency_key is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;
  v_fingerprint := encode(extensions.digest(p_payload::text, 'sha256'), 'hex');
  insert into private.admin_command_receipts(
    actor_id, action, idempotency_key, request_fingerprint
  ) values (p_actor_id, p_action, p_idempotency_key, v_fingerprint)
  on conflict do nothing;
  select * into strict v_receipt from private.admin_command_receipts
  where actor_id = p_actor_id and action = p_action
    and idempotency_key = p_idempotency_key for update;
  if v_receipt.request_fingerprint <> v_fingerprint then
    raise exception 'ADMIN_IDEMPOTENCY_CONFLICT';
  end if;
  if v_receipt.audit_id is not null then
    select resource_id into v_case_id from private.admin_audit_log
    where id = v_receipt.audit_id;
    return v_case_id;
  end if;
  return null;
end;
$$;

create or replace function private.complete_admin_case_command(
  p_actor_id uuid,
  p_action text,
  p_case_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid,
  p_before jsonb,
  p_after jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_audit_id uuid;
begin
  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    request_id, idempotency_key, before_state, after_state
  ) values (
    p_actor_id, p_action, 'CASE', p_case_id, p_reason_code,
    nullif(btrim(p_note), ''), nullif(btrim(p_request_id), ''),
    p_idempotency_key, p_before, p_after
  ) returning id into v_audit_id;
  update private.admin_command_receipts set audit_id = v_audit_id
  where actor_id = p_actor_id and action = p_action
    and idempotency_key = p_idempotency_key;
end;
$$;

create or replace function private.append_admin_case_history(
  p_case_id uuid,
  p_actor_id uuid,
  p_action text,
  p_previous_status public.support_ticket_status,
  p_new_status public.support_ticket_status,
  p_reason_code text,
  p_note text,
  p_details jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.admin_case_history(
    case_id, actor_id, action, previous_status, new_status,
    reason_code, note, details
  ) values (
    p_case_id, p_actor_id, p_action, p_previous_status, p_new_status,
    p_reason_code, nullif(btrim(p_note), ''), coalesce(p_details, '{}'::jsonb)
  )
$$;

create or replace function public.admin_create_case(
  p_actor_id uuid,
  p_category text,
  p_priority text,
  p_subject text,
  p_description text,
  p_order_id uuid,
  p_shop_id uuid,
  p_delivery_task_id uuid,
  p_return_request_id uuid,
  p_merchant_id uuid,
  p_captain_id uuid,
  p_reason_code text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay_case_id uuid;
  v_case public.support_tickets;
  v_priority public.support_priority;
begin
  if p_category not in (
    'ORDER_ISSUE','DELIVERY_INCIDENT','MERCHANT_CONDUCT',
    'CAPTAIN_CONDUCT','SAFETY','FRAUD','OTHER'
  ) or nullif(btrim(p_subject), '') is null
    or nullif(btrim(p_description), '') is null then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;
  begin
    v_priority := p_priority::public.support_priority;
  exception when invalid_text_representation then
    raise exception 'ADMIN_REQUEST_INVALID';
  end;
  v_replay_case_id := private.claim_admin_case_command(
    p_actor_id, 'admin.case.create', p_idempotency_key,
    jsonb_build_object(
      'category', p_category, 'priority', p_priority,
      'subject', p_subject, 'description', p_description,
      'orderId', p_order_id, 'shopId', p_shop_id,
      'deliveryTaskId', p_delivery_task_id,
      'returnRequestId', p_return_request_id,
      'merchantId', p_merchant_id, 'captainId', p_captain_id,
      'reasonCode', p_reason_code
    )
  );
  if v_replay_case_id is not null then
    return public.get_admin_case(v_replay_case_id);
  end if;

  insert into public.support_tickets(
    ticket_number, raised_by_user_id, raised_by_type, order_id, shop_id,
    delivery_task_id, return_request_id, merchant_id, captain_id,
    category, priority, status, subject, description
  ) values (
    'CASE-' || upper(replace(gen_random_uuid()::text, '-', '')),
    p_actor_id, 'ADMIN', p_order_id, p_shop_id, p_delivery_task_id,
    p_return_request_id, p_merchant_id, p_captain_id,
    p_category, v_priority, 'OPEN', btrim(p_subject), btrim(p_description)
  ) returning * into v_case;

  perform private.append_admin_case_history(
    v_case.id, p_actor_id, 'CREATED', null, 'OPEN', p_reason_code,
    null, jsonb_build_object('category', p_category, 'priority', p_priority)
  );
  perform private.complete_admin_case_command(
    p_actor_id, 'admin.case.create', v_case.id, p_reason_code, null,
    p_request_id, p_idempotency_key, null,
    jsonb_build_object('status', 'OPEN', 'priority', p_priority,
      'category', p_category)
  );
  return public.get_admin_case(v_case.id);
end;
$$;

create or replace function public.admin_assign_case(
  p_actor_id uuid,
  p_case_id uuid,
  p_assigned_to uuid,
  p_assigned_team text,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay_case_id uuid;
  v_case public.support_tickets;
  v_previous_status public.support_ticket_status;
  v_before jsonb;
begin
  v_replay_case_id := private.claim_admin_case_command(
    p_actor_id, 'admin.case.assign', p_idempotency_key,
    jsonb_build_object('caseId', p_case_id, 'assignedTo', p_assigned_to,
      'assignedTeam', p_assigned_team, 'reasonCode', p_reason_code,
      'note', p_note)
  );
  if v_replay_case_id is not null then return public.get_admin_case(v_replay_case_id); end if;
  perform 1 from public.profiles
  where id = p_assigned_to and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'ADMIN_CASE_ASSIGNEE_INVALID'; end if;
  select * into v_case from public.support_tickets where id = p_case_id for update;
  if not found then raise exception 'ADMIN_CASE_NOT_FOUND'; end if;
  if v_case.status in ('RESOLVED','CLOSED') then raise exception 'ADMIN_CASE_STATE_CONFLICT'; end if;
  v_previous_status := v_case.status;
  v_before := jsonb_build_object('status', v_case.status,
    'assignedTo', v_case.assigned_to, 'assignedTeam', v_case.assigned_team,
    'version', v_case.version);
  update public.support_tickets
  set assigned_to = p_assigned_to,
      assigned_team = nullif(btrim(p_assigned_team), ''),
      status = case when status = 'ESCALATED' then status else 'ASSIGNED' end,
      version = version + 1,
      updated_at = transaction_timestamp()
  where id = p_case_id returning * into v_case;
  perform private.append_admin_case_history(
    p_case_id, p_actor_id, 'ASSIGNED', v_previous_status, v_case.status,
    p_reason_code, p_note, jsonb_build_object('assignedTo', p_assigned_to,
      'assignedTeam', p_assigned_team)
  );
  perform private.complete_admin_case_command(
    p_actor_id, 'admin.case.assign', p_case_id, p_reason_code, p_note,
    p_request_id, p_idempotency_key, v_before,
    jsonb_build_object('status', v_case.status, 'assignedTo', v_case.assigned_to,
      'assignedTeam', v_case.assigned_team, 'version', v_case.version)
  );
  return public.get_admin_case(p_case_id);
end;
$$;

create or replace function public.admin_add_case_note(
  p_actor_id uuid,
  p_case_id uuid,
  p_message text,
  p_attachment_object_key text,
  p_reason_code text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay_case_id uuid;
  v_case public.support_tickets;
  v_previous_status public.support_ticket_status;
  v_message_id bigint;
begin
  if nullif(btrim(p_message), '') is null then raise exception 'ADMIN_REQUEST_INVALID'; end if;
  v_replay_case_id := private.claim_admin_case_command(
    p_actor_id, 'admin.case.add_note', p_idempotency_key,
    jsonb_build_object('caseId', p_case_id, 'message', p_message,
      'attachmentObjectKey', p_attachment_object_key, 'reasonCode', p_reason_code)
  );
  if v_replay_case_id is not null then return public.get_admin_case(v_replay_case_id); end if;
  select * into v_case from public.support_tickets where id = p_case_id for update;
  if not found then raise exception 'ADMIN_CASE_NOT_FOUND'; end if;
  if v_case.status = 'CLOSED' then raise exception 'ADMIN_CASE_STATE_CONFLICT'; end if;
  v_previous_status := v_case.status;
  insert into public.support_messages(
    ticket_id, sender_id, message_type, message,
    attachment_object_key, is_internal_note
  ) values (
    p_case_id, p_actor_id,
    case when p_attachment_object_key is null then 'TEXT'::public.support_message_type
      else 'FILE'::public.support_message_type end,
    btrim(p_message), nullif(btrim(p_attachment_object_key), ''), true
  ) returning id into v_message_id;
  update public.support_tickets
  set first_response_at = coalesce(first_response_at, transaction_timestamp()),
      status = case when status = 'ASSIGNED' then 'IN_PROGRESS' else status end,
      version = version + 1,
      updated_at = transaction_timestamp()
  where id = p_case_id returning * into v_case;
  perform private.append_admin_case_history(
    p_case_id, p_actor_id, 'NOTE_ADDED', v_previous_status, v_case.status,
    p_reason_code, p_message, jsonb_build_object('messageId', v_message_id,
      'hasAttachment', p_attachment_object_key is not null)
  );
  perform private.complete_admin_case_command(
    p_actor_id, 'admin.case.add_note', p_case_id, p_reason_code, p_message,
    p_request_id, p_idempotency_key,
    jsonb_build_object('status', v_previous_status),
    jsonb_build_object('status', v_case.status, 'messageId', v_message_id,
      'version', v_case.version)
  );
  return public.get_admin_case(p_case_id);
end;
$$;

create or replace function public.admin_escalate_case(
  p_actor_id uuid,
  p_case_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay_case_id uuid;
  v_case public.support_tickets;
  v_previous_status public.support_ticket_status;
begin
  v_replay_case_id := private.claim_admin_case_command(
    p_actor_id, 'admin.case.escalate', p_idempotency_key,
    jsonb_build_object('caseId', p_case_id, 'reasonCode', p_reason_code,
      'note', p_note)
  );
  if v_replay_case_id is not null then return public.get_admin_case(v_replay_case_id); end if;
  select * into v_case from public.support_tickets where id = p_case_id for update;
  if not found then raise exception 'ADMIN_CASE_NOT_FOUND'; end if;
  if v_case.status in ('RESOLVED','CLOSED') then raise exception 'ADMIN_CASE_STATE_CONFLICT'; end if;
  v_previous_status := v_case.status;
  update public.support_tickets
  set status = 'ESCALATED', priority = 'URGENT',
      escalated_at = coalesce(escalated_at, transaction_timestamp()),
      version = version + 1, updated_at = transaction_timestamp()
  where id = p_case_id returning * into v_case;
  perform private.append_admin_case_history(
    p_case_id, p_actor_id, 'ESCALATED', v_previous_status, 'ESCALATED',
    p_reason_code, p_note, jsonb_build_object('priority', 'URGENT')
  );
  perform private.complete_admin_case_command(
    p_actor_id, 'admin.case.escalate', p_case_id, p_reason_code, p_note,
    p_request_id, p_idempotency_key,
    jsonb_build_object('status', v_previous_status),
    jsonb_build_object('status', 'ESCALATED', 'priority', 'URGENT',
      'version', v_case.version)
  );
  return public.get_admin_case(p_case_id);
end;
$$;

create or replace function public.admin_resolve_case(
  p_actor_id uuid,
  p_case_id uuid,
  p_resolution_code text,
  p_resolution_note text,
  p_reason_code text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay_case_id uuid;
  v_case public.support_tickets;
  v_previous_status public.support_ticket_status;
begin
  if nullif(btrim(p_resolution_code), '') is null
    or nullif(btrim(p_resolution_note), '') is null then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;
  v_replay_case_id := private.claim_admin_case_command(
    p_actor_id, 'admin.case.resolve', p_idempotency_key,
    jsonb_build_object('caseId', p_case_id,
      'resolutionCode', p_resolution_code,
      'resolutionNote', p_resolution_note, 'reasonCode', p_reason_code)
  );
  if v_replay_case_id is not null then return public.get_admin_case(v_replay_case_id); end if;
  select * into v_case from public.support_tickets where id = p_case_id for update;
  if not found then raise exception 'ADMIN_CASE_NOT_FOUND'; end if;
  if v_case.status in ('RESOLVED','CLOSED') then raise exception 'ADMIN_CASE_STATE_CONFLICT'; end if;
  v_previous_status := v_case.status;
  update public.support_tickets
  set status = 'RESOLVED', resolution_code = btrim(p_resolution_code),
      resolution_note = btrim(p_resolution_note),
      resolved_at = transaction_timestamp(), closed_at = null,
      version = version + 1, updated_at = transaction_timestamp()
  where id = p_case_id returning * into v_case;
  perform private.append_admin_case_history(
    p_case_id, p_actor_id, 'RESOLVED', v_previous_status, 'RESOLVED',
    p_reason_code, p_resolution_note,
    jsonb_build_object('resolutionCode', p_resolution_code)
  );
  perform private.complete_admin_case_command(
    p_actor_id, 'admin.case.resolve', p_case_id, p_reason_code,
    p_resolution_note, p_request_id, p_idempotency_key,
    jsonb_build_object('status', v_previous_status),
    jsonb_build_object('status', 'RESOLVED',
      'resolutionCode', p_resolution_code, 'version', v_case.version)
  );
  return public.get_admin_case(p_case_id);
end;
$$;

create or replace function public.admin_close_case(
  p_actor_id uuid,
  p_case_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay_case_id uuid;
  v_case public.support_tickets;
begin
  v_replay_case_id := private.claim_admin_case_command(
    p_actor_id, 'admin.case.close', p_idempotency_key,
    jsonb_build_object('caseId', p_case_id, 'reasonCode', p_reason_code,
      'note', p_note)
  );
  if v_replay_case_id is not null then return public.get_admin_case(v_replay_case_id); end if;
  select * into v_case from public.support_tickets where id = p_case_id for update;
  if not found then raise exception 'ADMIN_CASE_NOT_FOUND'; end if;
  if v_case.status <> 'RESOLVED' then raise exception 'ADMIN_CASE_STATE_CONFLICT'; end if;
  update public.support_tickets
  set status = 'CLOSED', closed_at = transaction_timestamp(),
      version = version + 1, updated_at = transaction_timestamp()
  where id = p_case_id returning * into v_case;
  perform private.append_admin_case_history(
    p_case_id, p_actor_id, 'CLOSED', 'RESOLVED', 'CLOSED',
    p_reason_code, p_note, '{}'::jsonb
  );
  perform private.complete_admin_case_command(
    p_actor_id, 'admin.case.close', p_case_id, p_reason_code, p_note,
    p_request_id, p_idempotency_key,
    jsonb_build_object('status', 'RESOLVED'),
    jsonb_build_object('status', 'CLOSED', 'version', v_case.version)
  );
  return public.get_admin_case(p_case_id);
end;
$$;

revoke all on function public.get_admin_case(uuid) from public, anon, authenticated;
revoke all on function public.list_admin_cases(text,text,uuid,integer) from public, anon, authenticated;
revoke all on function public.admin_create_case(uuid,text,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_assign_case(uuid,uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_add_case_note(uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_escalate_case(uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_resolve_case(uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_close_case(uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.get_admin_case(uuid) to service_role;
grant execute on function public.list_admin_cases(text,text,uuid,integer) to service_role;
grant execute on function public.admin_create_case(uuid,text,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.admin_assign_case(uuid,uuid,uuid,text,text,text,text,uuid) to service_role;
grant execute on function public.admin_add_case_note(uuid,uuid,text,text,text,text,uuid) to service_role;
grant execute on function public.admin_escalate_case(uuid,uuid,text,text,text,uuid) to service_role;
grant execute on function public.admin_resolve_case(uuid,uuid,text,text,text,text,uuid) to service_role;
grant execute on function public.admin_close_case(uuid,uuid,text,text,text,uuid) to service_role;
