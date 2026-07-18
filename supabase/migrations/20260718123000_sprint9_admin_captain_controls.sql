create or replace function public.get_admin_captain_operations(p_captain_id uuid)
returns jsonb
language sql
security definer
set search_path = public, private, extensions
stable
as $$
  select jsonb_build_object(
    'captain', jsonb_build_object(
      'id', c.user_id,
      'captainCode', c.captain_code,
      'fullName', p.full_name,
      'phoneNumber', p.phone_number,
      'profileStatus', p.status,
      'kycStatus', c.kyc_status,
      'availabilityStatus', c.availability_status,
      'vehicleType', c.vehicle_type,
      'vehicleNumber', c.vehicle_number,
      'ratingAverage', c.rating_average,
      'ratingCount', c.rating_count,
      'completedDeliveries', c.completed_deliveries,
      'cashBalancePaise', c.cash_balance_paise,
      'approvedAt', c.approved_at,
      'updatedAt', c.updated_at
    ),
    'activeDelivery', (
      select jsonb_build_object(
        'taskId', d.id, 'orderId', d.order_id, 'status', d.status,
        'assignedAt', d.assigned_at, 'pickedUpAt', d.picked_up_at,
        'problemReportedAt', d.problem_reported_at
      ) from public.delivery_tasks d
      where d.assigned_captain_id = c.user_id
        and d.status not in ('COMPLETED','FAILED','CANCELLED')
      order by d.created_at desc limit 1
    ),
    'location', (
      select jsonb_build_object(
        'latitude', st_y(l.location::geometry),
        'longitude', st_x(l.location::geometry),
        'accuracyMeters', l.accuracy_meters,
        'recordedAt', l.recorded_at,
        'activeDeliveryTaskId', l.active_delivery_task_id,
        'updatedAt', l.updated_at
      ) from public.captain_current_locations l where l.captain_id = c.user_id
    ),
    'metrics', jsonb_build_object(
      'problemDeliveries30d', (select count(*)::integer from public.delivery_tasks d
        where d.assigned_captain_id = c.user_id and d.problem_reported_at >= now() - interval '30 days'),
      'pendingEarningsPaise', coalesce((select sum(e.total_paise)::bigint from public.captain_earnings e
        where e.captain_id = c.user_id and e.status = 'PENDING'), 0)
    )
  )
  from public.captain_profiles c
  join public.profiles p on p.id = c.user_id
  where c.user_id = p_captain_id
$$;

create or replace function private.claim_captain_admin_command(
  p_actor_id uuid,
  p_action text,
  p_captain_id uuid,
  p_reason_code text,
  p_note text,
  p_idempotency_key uuid,
  p_extra text default ''
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_receipt private.admin_command_receipts%rowtype;
begin
  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'ADMIN_ACCESS_DENIED'; end if;
  v_fingerprint := encode(extensions.digest(concat_ws('|', p_captain_id::text,
    p_reason_code, coalesce(p_note,''), p_extra), 'sha256'), 'hex');
  insert into private.admin_command_receipts(actor_id, action, idempotency_key, request_fingerprint)
  values (p_actor_id, p_action, p_idempotency_key, v_fingerprint) on conflict do nothing;
  select * into strict v_receipt from private.admin_command_receipts
  where actor_id = p_actor_id and action = p_action and idempotency_key = p_idempotency_key
  for update;
  if v_receipt.request_fingerprint <> v_fingerprint then
    raise exception 'ADMIN_IDEMPOTENCY_CONFLICT';
  end if;
  return v_receipt.audit_id is not null;
end;
$$;

create or replace function private.complete_captain_admin_command(
  p_actor_id uuid,
  p_action text,
  p_captain_id uuid,
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
declare
  v_audit_id uuid;
begin
  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    request_id, idempotency_key, before_state, after_state
  ) values (
    p_actor_id, p_action, 'CAPTAIN', p_captain_id, p_reason_code,
    nullif(btrim(p_note),''), nullif(btrim(p_request_id),''), p_idempotency_key,
    p_before, p_after
  ) returning id into v_audit_id;
  update private.admin_command_receipts set audit_id = v_audit_id
  where actor_id = p_actor_id and action = p_action and idempotency_key = p_idempotency_key;
end;
$$;

create or replace function public.admin_set_captain_operational_status(
  p_actor_id uuid,
  p_captain_id uuid,
  p_target_status text,
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
  v_profile public.profiles;
  v_captain public.captain_profiles;
  v_task public.delivery_tasks;
  v_action text;
  v_before jsonb;
begin
  if p_target_status not in ('SUSPENDED','ACTIVE') then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;
  v_action := 'admin.captain.' || lower(p_target_status);
  if private.claim_captain_admin_command(
    p_actor_id, v_action, p_captain_id, p_reason_code, p_note,
    p_idempotency_key, p_target_status
  ) then return public.get_admin_captain_operations(p_captain_id); end if;

  select * into v_profile from public.profiles where id = p_captain_id;
  select * into v_captain from public.captain_profiles where user_id = p_captain_id;
  if not found or v_profile.account_type <> 'CAPTAIN' then
    raise exception 'ADMIN_CAPTAIN_NOT_FOUND';
  end if;
  select * into v_task from public.delivery_tasks
  where assigned_captain_id = p_captain_id
    and status not in ('COMPLETED','FAILED','CANCELLED')
  order by created_at desc limit 1;

  if p_target_status = 'SUSPENDED' and v_task.id is not null then
    if v_task.status not in ('ASSIGNED','AT_PICKUP') or v_task.picked_up_at is not null then
      raise exception 'ADMIN_CAPTAIN_ACTIVE_DELIVERY_CONFLICT';
    end if;
    perform public.release_delivery_task(
      p_actor_id, v_task.id, 'OTHER', p_note, true, p_idempotency_key,
      null, null, null, null
    );
  elsif p_target_status = 'ACTIVE' then
    if v_task.id is not null or v_profile.status <> 'SUSPENDED'
      or v_captain.kyc_status <> 'VERIFIED' or v_captain.approved_at is null then
      raise exception 'ADMIN_CAPTAIN_STATE_CONFLICT';
    end if;
  end if;

  select * into strict v_profile from public.profiles where id = p_captain_id for update;
  select * into strict v_captain from public.captain_profiles where user_id = p_captain_id for update;
  v_before := jsonb_build_object(
    'profileStatus', v_profile.status,
    'availabilityStatus', v_captain.availability_status,
    'activeDeliveryTaskId', v_task.id
  );

  if p_target_status = 'SUSPENDED' then
    update public.profiles set status = 'SUSPENDED' where id = p_captain_id;
    update public.captain_profiles set availability_status = 'SUSPENDED',
      updated_at = transaction_timestamp() where user_id = p_captain_id;
    update public.captain_current_locations set active_delivery_task_id = null,
      updated_at = transaction_timestamp() where captain_id = p_captain_id;
  else
    update public.profiles set status = 'ACTIVE' where id = p_captain_id;
    update public.captain_profiles set availability_status = 'OFFLINE',
      updated_at = transaction_timestamp() where user_id = p_captain_id;
  end if;

  perform private.complete_captain_admin_command(
    p_actor_id, v_action, p_captain_id, p_reason_code, p_note, p_request_id,
    p_idempotency_key, v_before,
    jsonb_build_object('profileStatus', p_target_status,
      'availabilityStatus', case when p_target_status = 'ACTIVE' then 'OFFLINE' else 'SUSPENDED' end)
  );
  return public.get_admin_captain_operations(p_captain_id);
end;
$$;

create or replace function public.admin_correct_captain_availability(
  p_actor_id uuid,
  p_captain_id uuid,
  p_target_availability text,
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
  v_profile public.profiles;
  v_captain public.captain_profiles;
  v_before jsonb;
begin
  if p_target_availability not in ('OFFLINE','AVAILABLE','ON_BREAK') then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;
  if private.claim_captain_admin_command(
    p_actor_id, 'admin.captain.correct_availability', p_captain_id,
    p_reason_code, p_note, p_idempotency_key, p_target_availability
  ) then return public.get_admin_captain_operations(p_captain_id); end if;

  select * into v_profile from public.profiles where id = p_captain_id for update;
  select * into v_captain from public.captain_profiles where user_id = p_captain_id for update;
  if not found or v_profile.account_type <> 'CAPTAIN' then
    raise exception 'ADMIN_CAPTAIN_NOT_FOUND';
  end if;
  if v_profile.status <> 'ACTIVE' or v_captain.kyc_status <> 'VERIFIED'
    or v_captain.approved_at is null or exists (
      select 1 from public.delivery_tasks where assigned_captain_id = p_captain_id
      and status not in ('COMPLETED','FAILED','CANCELLED')
    ) then raise exception 'ADMIN_CAPTAIN_STATE_CONFLICT'; end if;

  v_before := jsonb_build_object('availabilityStatus', v_captain.availability_status);
  update public.captain_profiles
  set availability_status = p_target_availability::public.captain_availability_status,
      updated_at = transaction_timestamp()
  where user_id = p_captain_id;
  perform private.complete_captain_admin_command(
    p_actor_id, 'admin.captain.correct_availability', p_captain_id,
    p_reason_code, p_note, p_request_id, p_idempotency_key, v_before,
    jsonb_build_object('availabilityStatus', p_target_availability)
  );
  return public.get_admin_captain_operations(p_captain_id);
end;
$$;

create or replace function public.admin_release_captain_assignment(
  p_actor_id uuid,
  p_captain_id uuid,
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
  v_task public.delivery_tasks;
  v_before jsonb;
begin
  if private.claim_captain_admin_command(
    p_actor_id, 'admin.captain.release_assignment', p_captain_id,
    p_reason_code, p_note, p_idempotency_key, ''
  ) then return public.get_admin_captain_operations(p_captain_id); end if;

  select * into v_task from public.delivery_tasks
  where assigned_captain_id = p_captain_id
    and status not in ('COMPLETED','FAILED','CANCELLED')
  order by created_at desc limit 1;
  if not found then raise exception 'ADMIN_CAPTAIN_ACTIVE_DELIVERY_NOT_FOUND'; end if;
  if v_task.status not in ('ASSIGNED','AT_PICKUP') or v_task.picked_up_at is not null then
    raise exception 'ADMIN_CAPTAIN_ACTIVE_DELIVERY_CONFLICT';
  end if;
  v_before := jsonb_build_object(
    'deliveryTaskId', v_task.id, 'taskStatus', v_task.status,
    'availabilityStatus', (select availability_status from public.captain_profiles
      where user_id = p_captain_id)
  );
  perform public.release_delivery_task(
    p_actor_id, v_task.id, 'OTHER', p_note, true, p_idempotency_key,
    null, null, null, null
  );
  perform private.complete_captain_admin_command(
    p_actor_id, 'admin.captain.release_assignment', p_captain_id,
    p_reason_code, p_note, p_request_id, p_idempotency_key, v_before,
    jsonb_build_object('deliveryTaskId', v_task.id, 'taskStatus', 'SEARCHING',
      'availabilityStatus', 'AVAILABLE')
  );
  return public.get_admin_captain_operations(p_captain_id);
end;
$$;

revoke all on function public.get_admin_captain_operations(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_captain_operational_status(uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_correct_captain_availability(uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_release_captain_assignment(uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.get_admin_captain_operations(uuid) to service_role;
grant execute on function public.admin_set_captain_operational_status(uuid,uuid,text,text,text,text,uuid) to service_role;
grant execute on function public.admin_correct_captain_availability(uuid,uuid,text,text,text,text,uuid) to service_role;
grant execute on function public.admin_release_captain_assignment(uuid,uuid,text,text,text,uuid) to service_role;
