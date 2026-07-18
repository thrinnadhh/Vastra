create or replace function public.get_admin_merchant_operations(p_merchant_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'merchant', jsonb_build_object(
      'id', m.user_id,
      'fullName', p.full_name,
      'phoneNumber', p.phone_number,
      'profileStatus', p.status,
      'legalName', m.legal_name,
      'onboardingStatus', m.onboarding_status,
      'kycStatus', m.kyc_status,
      'updatedAt', m.updated_at
    ),
    'shops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'shopCode', s.shop_code,
        'name', s.name,
        'verificationStatus', s.verification_status,
        'operationalStatus', s.operational_status,
        'acceptsOnlineOrders', s.accepts_online_orders,
        'updatedAt', s.updated_at
      ) order by s.created_at)
      from public.shops s where s.merchant_id = m.user_id and s.deleted_at is null
    ), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'openOrders', (select count(*)::integer from public.orders o join public.shops s on s.id = o.shop_id where s.merchant_id = m.user_id and o.status not in ('COMPLETED','CANCELLED')),
      'cancelledOrders30d', (select count(*)::integer from public.orders o join public.shops s on s.id = o.shop_id where s.merchant_id = m.user_id and o.status = 'CANCELLED' and o.updated_at >= now() - interval '30 days'),
      'problemOrders30d', (select count(*)::integer from public.orders o join public.shops s on s.id = o.shop_id where s.merchant_id = m.user_id and o.status = 'PROBLEM_REPORTED' and o.updated_at >= now() - interval '30 days')
    )
  )
  from public.merchant_profiles m
  join public.profiles p on p.id = m.user_id
  where m.user_id = p_merchant_id
$$;

create or replace function public.admin_set_merchant_operational_status(
  p_actor_id uuid,
  p_merchant_id uuid,
  p_target_status text,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_profile public.profiles%rowtype;
  v_merchant public.merchant_profiles%rowtype;
  v_action text;
  v_fingerprint text;
  v_receipt private.admin_command_receipts%rowtype;
  v_audit_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if p_target_status not in ('PAUSED','SUSPENDED','ACTIVE') then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;
  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'ADMIN_ACCESS_DENIED'; end if;

  select * into v_profile from public.profiles where id = p_merchant_id for update;
  select * into v_merchant from public.merchant_profiles where user_id = p_merchant_id for update;
  if not found or v_profile.account_type <> 'MERCHANT' then
    raise exception 'ADMIN_MERCHANT_NOT_FOUND';
  end if;
  if p_target_status = 'ACTIVE' and (
    v_merchant.kyc_status <> 'VERIFIED'
    or v_profile.status not in ('ACTIVE','SUSPENDED')
  ) then
    raise exception 'ADMIN_MERCHANT_STATE_CONFLICT';
  end if;
  if p_target_status = 'PAUSED' and v_profile.status <> 'ACTIVE' then
    raise exception 'ADMIN_MERCHANT_STATE_CONFLICT';
  end if;

  v_action := 'admin.merchant.' || lower(p_target_status);
  v_fingerprint := encode(extensions.digest(concat_ws('|', p_merchant_id::text,
    p_target_status, p_reason_code, coalesce(p_note,'')), 'sha256'), 'hex');
  insert into private.admin_command_receipts(actor_id, action, idempotency_key, request_fingerprint)
  values (p_actor_id, v_action, p_idempotency_key, v_fingerprint)
  on conflict do nothing;
  select * into strict v_receipt from private.admin_command_receipts
   where actor_id = p_actor_id and action = v_action and idempotency_key = p_idempotency_key
   for update;
  if v_receipt.request_fingerprint <> v_fingerprint then
    raise exception 'ADMIN_IDEMPOTENCY_CONFLICT';
  end if;
  if v_receipt.audit_id is not null then
    return public.get_admin_merchant_operations(p_merchant_id);
  end if;

  v_before := jsonb_build_object(
    'profileStatus', v_profile.status,
    'onboardingStatus', v_merchant.onboarding_status,
    'shops', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'operationalStatus', s.operational_status,
      'acceptsOnlineOrders', s.accepts_online_orders
    ) order by s.id), '[]'::jsonb) from public.shops s
      where s.merchant_id = p_merchant_id and s.deleted_at is null)
  );
  if p_target_status = 'PAUSED' then
    update public.merchant_profiles set onboarding_status = 'PAUSED'
      where user_id = p_merchant_id;
    update public.shops set operational_status = 'PAUSED', accepts_online_orders = false
      where merchant_id = p_merchant_id and deleted_at is null;
  elsif p_target_status = 'SUSPENDED' then
    update public.profiles set status = 'SUSPENDED' where id = p_merchant_id;
    update public.merchant_profiles set onboarding_status = 'SUSPENDED'
      where user_id = p_merchant_id;
    update public.shops set operational_status = 'SUSPENDED', accepts_online_orders = false
      where merchant_id = p_merchant_id and deleted_at is null;
  else
    update public.profiles set status = 'ACTIVE' where id = p_merchant_id;
    update public.merchant_profiles set onboarding_status = 'ACTIVE'
      where user_id = p_merchant_id;
    update public.shops set operational_status = 'TEMPORARILY_CLOSED', accepts_online_orders = false
      where merchant_id = p_merchant_id and deleted_at is null
        and operational_status in ('PAUSED','SUSPENDED');
  end if;
  v_after := jsonb_build_object(
    'targetStatus', p_target_status,
    'profileStatus', (select status from public.profiles where id = p_merchant_id),
    'onboardingStatus', (select onboarding_status from public.merchant_profiles where user_id = p_merchant_id),
    'shopsOnlineDisabled', true
  );

  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    request_id, idempotency_key, before_state, after_state
  ) values (
    p_actor_id, v_action, 'MERCHANT', p_merchant_id, p_reason_code,
    nullif(trim(p_note),''), nullif(trim(p_request_id),''), p_idempotency_key,
    v_before, v_after
  ) returning id into v_audit_id;
  update private.admin_command_receipts set audit_id = v_audit_id
   where actor_id = p_actor_id and action = v_action and idempotency_key = p_idempotency_key;
  return public.get_admin_merchant_operations(p_merchant_id);
end;
$$;

revoke all on function public.get_admin_merchant_operations(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_merchant_operational_status(uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.get_admin_merchant_operations(uuid) to service_role;
grant execute on function public.admin_set_merchant_operational_status(uuid,uuid,text,text,text,text,uuid) to service_role;
