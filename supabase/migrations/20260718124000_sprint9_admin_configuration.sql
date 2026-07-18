create table if not exists private.system_setting_versions (
  id bigint generated always as identity primary key,
  setting_id uuid not null,
  setting_key text not null,
  scope_type public.system_setting_scope_type not null,
  scope_id text,
  version integer not null,
  setting_value jsonb not null,
  changed_by uuid not null references public.profiles(id),
  reason_code text not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists system_setting_versions_unique_idx
  on private.system_setting_versions(setting_id, version);
alter table private.system_setting_versions enable row level security;
revoke all on private.system_setting_versions from anon, authenticated;
grant select, insert on private.system_setting_versions to service_role;

drop trigger if exists prevent_system_setting_version_mutation
  on private.system_setting_versions;
create trigger prevent_system_setting_version_mutation
before update or delete on private.system_setting_versions
for each row execute function private.prevent_append_only_mutation();

create or replace function private.validate_operational_setting(p_key text, p_value jsonb)
returns public.system_setting_value_type
language plpgsql
immutable
set search_path = public
as $$
declare v_number numeric;
begin
  if p_key = 'feature.admin_case_escalation' then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'ADMIN_SETTING_VALUE_INVALID';
    end if;
    return 'BOOLEAN';
  end if;
  if p_key not in (
    'dispatch.offer_ttl_seconds','dispatch.initial_radius_meters',
    'dispatch.radius_step_meters','dispatch.max_radius_meters',
    'dispatch.max_offer_waves','operations.order_intervention_minutes'
  ) or jsonb_typeof(p_value) <> 'number' then
    raise exception 'ADMIN_SETTING_VALUE_INVALID';
  end if;
  v_number := (p_value #>> '{}')::numeric;
  if p_key = 'dispatch.offer_ttl_seconds' and (v_number < 10 or v_number > 180) then
    raise exception 'ADMIN_SETTING_VALUE_INVALID';
  end if;
  if p_key in ('dispatch.initial_radius_meters','dispatch.radius_step_meters')
    and (v_number < 100 or v_number > 10000) then
    raise exception 'ADMIN_SETTING_VALUE_INVALID';
  end if;
  if p_key = 'dispatch.max_radius_meters' and (v_number < 1000 or v_number > 50000) then
    raise exception 'ADMIN_SETTING_VALUE_INVALID';
  end if;
  if p_key = 'dispatch.max_offer_waves'
    and (v_number < 1 or v_number > 20 or trunc(v_number) <> v_number) then
    raise exception 'ADMIN_SETTING_VALUE_INVALID';
  end if;
  if p_key = 'operations.order_intervention_minutes'
    and (v_number < 1 or v_number > 240 or trunc(v_number) <> v_number) then
    raise exception 'ADMIN_SETTING_VALUE_INVALID';
  end if;
  return 'NUMBER';
end;
$$;

create or replace function public.list_admin_operational_settings(
  p_scope_type text default null,
  p_scope_id text default null
) returns setof jsonb
language sql
security definer
set search_path = public
stable
as $$
  select to_jsonb(s)
  from public.system_settings s
  where s.is_secret = false
    and s.setting_key in (
      'dispatch.offer_ttl_seconds','dispatch.initial_radius_meters',
      'dispatch.radius_step_meters','dispatch.max_radius_meters',
      'dispatch.max_offer_waves','operations.order_intervention_minutes',
      'feature.admin_case_escalation'
    )
    and (p_scope_type is null or s.scope_type::text = p_scope_type)
    and (p_scope_id is null or s.scope_id = p_scope_id)
  order by s.setting_key, s.scope_type, s.scope_id nulls first
$$;

create or replace function public.admin_update_operational_setting(
  p_actor_id uuid,
  p_setting_key text,
  p_setting_value jsonb,
  p_scope_type text,
  p_scope_id text,
  p_expected_version integer,
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
  v_setting public.system_settings%rowtype;
  v_value_type public.system_setting_value_type;
  v_scope public.system_setting_scope_type;
  v_action text := 'admin.configuration.update';
  v_fingerprint text;
  v_receipt private.admin_command_receipts%rowtype;
  v_audit_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'ADMIN_ACCESS_DENIED'; end if;
  if p_setting_key not in (
    'dispatch.offer_ttl_seconds','dispatch.initial_radius_meters',
    'dispatch.radius_step_meters','dispatch.max_radius_meters',
    'dispatch.max_offer_waves','operations.order_intervention_minutes',
    'feature.admin_case_escalation'
  ) then raise exception 'ADMIN_SETTING_KEY_INVALID'; end if;
  begin
    v_scope := p_scope_type::public.system_setting_scope_type;
  exception when invalid_text_representation then
    raise exception 'ADMIN_SETTING_SCOPE_INVALID';
  end;
  if (v_scope = 'GLOBAL' and p_scope_id is not null)
    or (v_scope <> 'GLOBAL' and nullif(trim(p_scope_id),'') is null) then
    raise exception 'ADMIN_SETTING_SCOPE_INVALID';
  end if;
  v_value_type := private.validate_operational_setting(p_setting_key, p_setting_value);
  v_fingerprint := encode(extensions.digest(concat_ws('|', p_setting_key,
    v_scope::text, coalesce(p_scope_id,''), p_setting_value::text,
    coalesce(p_expected_version::text,''), p_reason_code, coalesce(p_note,'')),
    'sha256'), 'hex');

  insert into private.admin_command_receipts(
    actor_id, action, idempotency_key, request_fingerprint
  ) values (p_actor_id, v_action, p_idempotency_key, v_fingerprint)
  on conflict do nothing;
  select * into strict v_receipt from private.admin_command_receipts
   where actor_id = p_actor_id and action = v_action
     and idempotency_key = p_idempotency_key for update;
  if v_receipt.request_fingerprint <> v_fingerprint then
    raise exception 'ADMIN_IDEMPOTENCY_CONFLICT';
  end if;
  if v_receipt.audit_id is not null then
    select * into v_setting from public.system_settings
     where setting_key = p_setting_key and scope_type = v_scope
       and coalesce(scope_id,'') = coalesce(p_scope_id,'');
    return to_jsonb(v_setting);
  end if;

  select * into v_setting from public.system_settings
   where setting_key = p_setting_key and scope_type = v_scope
     and coalesce(scope_id,'') = coalesce(p_scope_id,'') for update;
  if found then
    if p_expected_version is null or p_expected_version <> v_setting.version then
      raise exception 'ADMIN_SETTING_VERSION_CONFLICT';
    end if;
    v_before := to_jsonb(v_setting);
    insert into private.system_setting_versions(
      setting_id, setting_key, scope_type, scope_id, version, setting_value,
      changed_by, reason_code, note
    ) values (
      v_setting.id, v_setting.setting_key, v_setting.scope_type,
      v_setting.scope_id, v_setting.version, v_setting.setting_value,
      p_actor_id, p_reason_code, nullif(trim(p_note),'')
    );
    update public.system_settings
    set setting_value = p_setting_value,
        value_type = v_value_type,
        version = version + 1,
        updated_by = p_actor_id
    where id = v_setting.id returning * into v_setting;
  else
    if p_expected_version is not null then
      raise exception 'ADMIN_SETTING_VERSION_CONFLICT';
    end if;
    insert into public.system_settings(
      setting_key, setting_value, value_type, scope_type, scope_id,
      is_secret, version, updated_by
    ) values (
      p_setting_key, p_setting_value, v_value_type, v_scope,
      nullif(trim(p_scope_id),''), false, 1, p_actor_id
    ) returning * into v_setting;
    v_before := null;
  end if;
  v_after := to_jsonb(v_setting);
  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    request_id, idempotency_key, before_state, after_state
  ) values (
    p_actor_id, v_action, 'CONFIGURATION', v_setting.id, p_reason_code,
    nullif(trim(p_note),''), nullif(trim(p_request_id),''), p_idempotency_key,
    v_before, v_after
  ) returning id into v_audit_id;
  update private.admin_command_receipts set audit_id = v_audit_id
   where actor_id = p_actor_id and action = v_action
     and idempotency_key = p_idempotency_key;
  return v_after;
end;
$$;

revoke all on function private.validate_operational_setting(text,jsonb)
  from public, anon, authenticated;
revoke all on function public.list_admin_operational_settings(text,text)
  from public, anon, authenticated;
revoke all on function public.admin_update_operational_setting(uuid,text,jsonb,text,text,integer,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.list_admin_operational_settings(text,text)
  to service_role;
grant execute on function public.admin_update_operational_setting(uuid,text,jsonb,text,text,integer,text,text,text,uuid)
  to service_role;
