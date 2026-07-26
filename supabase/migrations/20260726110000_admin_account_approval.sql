-- Complete the frozen-MVP merchant and captain onboarding path.
-- Approval is service-role only, idempotent, fully audited, and emits durable
-- notification/outbox records in the same transaction as the account changes.

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
      'approvedAt', m.approved_at,
      'approvedBy', m.approved_by,
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
      from public.shops s
      where s.merchant_id = m.user_id
        and s.deleted_at is null
    ), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'openOrders', (
        select count(*)::integer
        from public.orders o
        join public.shops s on s.id = o.shop_id
        where s.merchant_id = m.user_id
          and o.status not in ('COMPLETED', 'CANCELLED')
      ),
      'cancelledOrders30d', (
        select count(*)::integer
        from public.orders o
        join public.shops s on s.id = o.shop_id
        where s.merchant_id = m.user_id
          and o.status = 'CANCELLED'
          and o.updated_at >= now() - interval '30 days'
      ),
      'problemOrders30d', (
        select count(*)::integer
        from public.orders o
        join public.shops s on s.id = o.shop_id
        where s.merchant_id = m.user_id
          and o.status = 'PROBLEM_REPORTED'
          and o.updated_at >= now() - interval '30 days'
      )
    )
  )
  from public.merchant_profiles m
  join public.profiles p on p.id = m.user_id
  where m.user_id = p_merchant_id
$$;

create or replace function public.admin_approve_merchant(
  p_actor_id uuid,
  p_merchant_id uuid,
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
  v_profile public.profiles%rowtype;
  v_merchant public.merchant_profiles%rowtype;
  v_shop public.shops%rowtype;
  v_receipt private.admin_command_receipts%rowtype;
  v_fingerprint text;
  v_audit_id uuid;
  v_before jsonb;
begin
  perform 1
  from public.profiles
  where id = p_actor_id
    and account_type = 'ADMIN'
    and status = 'ACTIVE';
  if not found then
    raise exception 'ADMIN_ACCESS_DENIED';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_merchant_id::text,
        p_reason_code,
        coalesce(p_note, '')
      ),
      'sha256'
    ),
    'hex'
  );

  insert into private.admin_command_receipts(
    actor_id,
    action,
    idempotency_key,
    request_fingerprint
  ) values (
    p_actor_id,
    'admin.merchant.approve',
    p_idempotency_key,
    v_fingerprint
  )
  on conflict do nothing;

  select *
  into strict v_receipt
  from private.admin_command_receipts
  where actor_id = p_actor_id
    and action = 'admin.merchant.approve'
    and idempotency_key = p_idempotency_key
  for update;

  if v_receipt.request_fingerprint <> v_fingerprint then
    raise exception 'ADMIN_IDEMPOTENCY_CONFLICT';
  end if;
  if v_receipt.audit_id is not null then
    return public.get_admin_merchant_operations(p_merchant_id);
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_merchant_id
  for update;

  select *
  into v_merchant
  from public.merchant_profiles
  where user_id = p_merchant_id
  for update;

  if v_profile.id is null
    or v_merchant.user_id is null
    or v_profile.account_type <> 'MERCHANT'
  then
    raise exception 'ADMIN_MERCHANT_NOT_FOUND';
  end if;

  if v_profile.status not in ('PENDING', 'ACTIVE')
    or v_merchant.approved_at is not null
    or v_merchant.onboarding_status in ('REJECTED', 'SUSPENDED')
  then
    raise exception 'ADMIN_MERCHANT_STATE_CONFLICT';
  end if;

  select *
  into v_shop
  from public.shops
  where merchant_id = p_merchant_id
    and deleted_at is null
  order by created_at
  limit 1
  for update;

  if v_shop.id is null
    or (
      select count(*)
      from public.shops
      where merchant_id = p_merchant_id
        and deleted_at is null
    ) <> 1
    or not exists (
      select 1
      from public.shop_documents
      where shop_id = v_shop.id
        and verification_status <> 'REJECTED'
    )
    or not exists (
      select 1
      from public.shop_bank_accounts
      where shop_id = v_shop.id
        and is_primary
        and verification_status <> 'REJECTED'
    )
  then
    raise exception 'ADMIN_MERCHANT_STATE_CONFLICT';
  end if;

  v_before := jsonb_build_object(
    'profileStatus', v_profile.status,
    'onboardingStatus', v_merchant.onboarding_status,
    'kycStatus', v_merchant.kyc_status,
    'approvedAt', v_merchant.approved_at,
    'shopVerificationStatus', v_shop.verification_status,
    'shopOperationalStatus', v_shop.operational_status
  );

  update public.profiles
  set status = 'ACTIVE',
      updated_at = transaction_timestamp()
  where id = p_merchant_id;

  update public.merchant_profiles
  set onboarding_status = 'ACTIVE',
      kyc_status = 'VERIFIED',
      approved_at = transaction_timestamp(),
      approved_by = p_actor_id,
      updated_at = transaction_timestamp()
  where user_id = p_merchant_id;

  update public.shops
  set verification_status = 'VERIFIED',
      operational_status = 'TEMPORARILY_CLOSED',
      accepts_online_orders = false,
      updated_at = transaction_timestamp()
  where id = v_shop.id;

  update public.shop_documents
  set verification_status = 'VERIFIED',
      verified_by = p_actor_id,
      verified_at = transaction_timestamp(),
      rejection_reason = null,
      updated_at = transaction_timestamp()
  where shop_id = v_shop.id
    and verification_status in ('PENDING', 'IN_REVIEW');

  update public.shop_bank_accounts
  set verification_status = 'VERIFIED',
      verified_by = p_actor_id,
      verified_at = transaction_timestamp(),
      rejection_reason = null,
      updated_at = transaction_timestamp()
  where shop_id = v_shop.id
    and verification_status in ('PENDING', 'IN_REVIEW');

  insert into public.notifications(
    user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id,
    priority,
    data
  ) values (
    p_merchant_id,
    'MERCHANT_APPROVED',
    'Your merchant account is approved',
    'Your shop is approved. Review your catalogue and open for online orders when ready.',
    'MERCHANT',
    p_merchant_id,
    'HIGH',
    jsonb_build_object('shopId', v_shop.id)
  );

  perform private.enqueue_outbox_event(
    'merchant.approved',
    'MERCHANT',
    p_merchant_id,
    jsonb_build_object(
      'merchantId', p_merchant_id,
      'shopId', v_shop.id,
      'approvedBy', p_actor_id
    )
  );

  insert into private.admin_audit_log(
    actor_id,
    action,
    resource_type,
    resource_id,
    reason_code,
    note,
    request_id,
    idempotency_key,
    before_state,
    after_state
  ) values (
    p_actor_id,
    'admin.merchant.approve',
    'MERCHANT',
    p_merchant_id,
    p_reason_code,
    nullif(btrim(p_note), ''),
    nullif(btrim(p_request_id), ''),
    p_idempotency_key,
    v_before,
    jsonb_build_object(
      'profileStatus', 'ACTIVE',
      'onboardingStatus', 'ACTIVE',
      'kycStatus', 'VERIFIED',
      'shopVerificationStatus', 'VERIFIED',
      'shopOperationalStatus', 'TEMPORARILY_CLOSED',
      'acceptsOnlineOrders', false
    )
  )
  returning id into v_audit_id;

  update private.admin_command_receipts
  set audit_id = v_audit_id
  where actor_id = p_actor_id
    and action = 'admin.merchant.approve'
    and idempotency_key = p_idempotency_key;

  return public.get_admin_merchant_operations(p_merchant_id);
end;
$$;

create or replace function public.admin_approve_captain(
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
  v_profile public.profiles%rowtype;
  v_captain public.captain_profiles%rowtype;
  v_before jsonb;
begin
  if private.claim_captain_admin_command(
    p_actor_id,
    'admin.captain.approve',
    p_captain_id,
    p_reason_code,
    p_note,
    p_idempotency_key,
    ''
  ) then
    return public.get_admin_captain_operations(p_captain_id);
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_captain_id
  for update;

  select *
  into v_captain
  from public.captain_profiles
  where user_id = p_captain_id
  for update;

  if v_profile.id is null
    or v_captain.user_id is null
    or v_profile.account_type <> 'CAPTAIN'
  then
    raise exception 'ADMIN_CAPTAIN_NOT_FOUND';
  end if;

  if v_profile.status not in ('PENDING', 'ACTIVE')
    or v_captain.approved_at is not null
    or v_captain.kyc_status = 'REJECTED'
    or v_captain.vehicle_type is null
    or nullif(btrim(v_captain.vehicle_number), '') is null
    or nullif(btrim(v_captain.driving_licence_last4), '') is null
    or nullif(btrim(v_captain.driving_licence_encrypted), '') is null
  then
    raise exception 'ADMIN_CAPTAIN_STATE_CONFLICT';
  end if;

  v_before := jsonb_build_object(
    'profileStatus', v_profile.status,
    'kycStatus', v_captain.kyc_status,
    'availabilityStatus', v_captain.availability_status,
    'approvedAt', v_captain.approved_at
  );

  update public.profiles
  set status = 'ACTIVE',
      updated_at = transaction_timestamp()
  where id = p_captain_id;

  update public.captain_profiles
  set kyc_status = 'VERIFIED',
      availability_status = 'OFFLINE',
      approved_at = transaction_timestamp(),
      updated_at = transaction_timestamp()
  where user_id = p_captain_id;

  insert into public.notifications(
    user_id,
    notification_type,
    title,
    body,
    entity_type,
    entity_id,
    priority,
    data
  ) values (
    p_captain_id,
    'CAPTAIN_APPROVED',
    'Your captain account is approved',
    'Your account is approved. Go available when you are ready to receive delivery offers.',
    'CAPTAIN',
    p_captain_id,
    'HIGH',
    '{}'::jsonb
  );

  perform private.enqueue_outbox_event(
    'captain.approved',
    'CAPTAIN',
    p_captain_id,
    jsonb_build_object(
      'captainId', p_captain_id,
      'approvedBy', p_actor_id
    )
  );

  perform private.complete_captain_admin_command(
    p_actor_id,
    'admin.captain.approve',
    p_captain_id,
    p_reason_code,
    p_note,
    p_request_id,
    p_idempotency_key,
    v_before,
    jsonb_build_object(
      'profileStatus', 'ACTIVE',
      'kycStatus', 'VERIFIED',
      'availabilityStatus', 'OFFLINE'
    )
  );

  return public.get_admin_captain_operations(p_captain_id);
end;
$$;

revoke all
on function public.admin_approve_merchant(uuid,uuid,text,text,text,uuid)
from public, anon, authenticated;
revoke all
on function public.admin_approve_captain(uuid,uuid,text,text,text,uuid)
from public, anon, authenticated;

grant execute
on function public.admin_approve_merchant(uuid,uuid,text,text,text,uuid)
to service_role;
grant execute
on function public.admin_approve_captain(uuid,uuid,text,text,text,uuid)
to service_role;
