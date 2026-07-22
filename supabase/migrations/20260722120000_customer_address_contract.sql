
-- Public, customer-owned address commands for BE-FE-002.

create unique index if not exists addresses_one_default_per_user_idx
on public.addresses (user_id)
where is_default;

create table if not exists private.customer_address_idempotency (
  customer_id uuid not null,
  idempotency_key uuid not null,
  operation text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, idempotency_key)
);

revoke all on private.customer_address_idempotency from public, anon, authenticated;
revoke insert, update, delete on public.addresses from authenticated;

create or replace function private.require_active_customer_address_actor()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1
    from public.profiles p
    join public.customer_profiles cp on cp.user_id = p.id
    where p.id = actor_id
      and p.account_type = 'CUSTOMER'
      and p.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'active customer required';
  end if;
  return actor_id;
end;
$$;

create or replace function private.validate_customer_address_payload(
  p_payload jsonb,
  p_patch boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_name text;
  text_value text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'address payload must be an object';
  end if;
  if p_patch and p_payload = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'address patch is empty';
  end if;
  for key_name in select jsonb_object_keys(p_payload)
  loop
    if key_name not in ('label','recipientName','phoneNumber','line1','line2','landmark','area','city','state','postalCode','countryCode','latitude','longitude','isDefault') then
      raise exception using errcode = '22023', message = 'unknown address field';
    end if;
  end loop;
  if not p_patch then
    if not (p_payload ?& array['recipientName','phoneNumber','line1','area','city','state','postalCode','countryCode','latitude','longitude']) then
      raise exception using errcode = '22023', message = 'required address field missing';
    end if;
  end if;
  foreach key_name in array array['recipientName','phoneNumber','line1','area','city','state','postalCode','countryCode']
  loop
    if p_payload ? key_name then
      text_value := btrim(p_payload ->> key_name);
      if text_value is null or text_value = '' then
        raise exception using errcode = '22023', message = 'address text field is empty';
      end if;
    end if;
  end loop;
  if p_payload ? 'phoneNumber' and (p_payload ->> 'phoneNumber') !~ '^\+?[1-9][0-9]{7,14}$' then
    raise exception using errcode = '22023', message = 'phone number is invalid';
  end if;
  if p_payload ? 'postalCode' and (p_payload ->> 'postalCode') !~ '^[0-9]{6}$' then
    raise exception using errcode = '22023', message = 'postal code is invalid';
  end if;
  if p_payload ? 'countryCode' and (p_payload ->> 'countryCode') <> 'IN' then
    raise exception using errcode = '22023', message = 'country code is unsupported';
  end if;
  if p_payload ? 'latitude' and ((p_payload ->> 'latitude')::double precision < -90 or (p_payload ->> 'latitude')::double precision > 90) then
    raise exception using errcode = '22023', message = 'latitude is invalid';
  end if;
  if p_payload ? 'longitude' and ((p_payload ->> 'longitude')::double precision < -180 or (p_payload ->> 'longitude')::double precision > 180) then
    raise exception using errcode = '22023', message = 'longitude is invalid';
  end if;
  if p_payload ? 'isDefault' and jsonb_typeof(p_payload -> 'isDefault') <> 'boolean' then
    raise exception using errcode = '22023', message = 'isDefault is invalid';
  end if;
end;
$$;

create or replace function private.customer_address_json(p_address_id uuid, p_customer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'label', a.label,
    'recipientName', a.recipient_name,
    'phoneNumber', a.phone_number,
    'line1', a.line1,
    'line2', a.line2,
    'landmark', a.landmark,
    'area', a.area,
    'city', a.city,
    'state', a.state,
    'postalCode', a.postal_code,
    'countryCode', a.country_code,
    'latitude', extensions.st_y(a.location::extensions.geometry),
    'longitude', extensions.st_x(a.location::extensions.geometry),
    'isDefault', a.is_default,
    'serviceable', exists (
      select 1
      from public.shops s
      where s.deleted_at is null
        and s.verification_status = 'VERIFIED'
        and s.accepts_online_orders
        and s.operational_status <> 'SUSPENDED'
        and extensions.st_dwithin(s.location, a.location, s.service_radius_meters)
    ),
    'createdAt', a.created_at,
    'updatedAt', a.updated_at
  )
  from public.addresses a
  where a.id = p_address_id and a.user_id = p_customer_id
$$;

create or replace function private.claim_customer_address_command(
  p_customer_id uuid,
  p_idempotency_key uuid,
  p_operation text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare replay private.customer_address_idempotency;
begin
  select * into replay
  from private.customer_address_idempotency
  where customer_id = p_customer_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if replay.operation <> p_operation or replay.request_hash <> p_request_hash then
      raise exception using errcode = '23505', message = 'idempotency key reused with another request';
    end if;
    return replay.response;
  end if;
  return null;
end;
$$;

create or replace function private.complete_customer_address_command(
  p_customer_id uuid,
  p_idempotency_key uuid,
  p_operation text,
  p_request_hash text,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.customer_address_idempotency(customer_id,idempotency_key,operation,request_hash,response)
  values (p_customer_id,p_idempotency_key,p_operation,p_request_hash,p_response);
  return p_response;
exception when unique_violation then
  return private.claim_customer_address_command(p_customer_id,p_idempotency_key,p_operation,p_request_hash);
end;
$$;

create or replace function public.list_customer_addresses()
returns table(address jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid := private.require_active_customer_address_actor();
begin
  return query
  select private.customer_address_json(a.id, actor_id)
  from public.addresses a
  where a.user_id = actor_id
  order by a.is_default desc, a.created_at asc, a.id asc;
end;
$$;

create or replace function public.get_customer_address(p_address_id uuid)
returns table(address jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid := private.require_active_customer_address_actor(); value jsonb;
begin
  value := private.customer_address_json(p_address_id, actor_id);
  if value is null then raise exception using errcode = 'P0002', message = 'address not found'; end if;
  return query select value;
end;
$$;

create or replace function public.create_customer_address(p_payload jsonb, p_idempotency_key uuid)
returns table(address jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_active_customer_address_actor();
  request_hash text := md5(p_payload::text);
  replay jsonb;
  new_id uuid;
  make_default boolean;
  result jsonb;
begin
  perform private.validate_customer_address_payload(p_payload, false);
  replay := private.claim_customer_address_command(actor_id,p_idempotency_key,'CREATE',request_hash);
  if replay is not null then return query select replay; return; end if;
  make_default := coalesce((p_payload ->> 'isDefault')::boolean,false) or not exists(select 1 from public.addresses where user_id = actor_id);
  if make_default then update public.addresses set is_default = false where user_id = actor_id and is_default; end if;
  insert into public.addresses(user_id,label,recipient_name,phone_number,line1,line2,landmark,area,city,state,postal_code,country_code,location,is_default)
  values (
    actor_id, nullif(btrim(p_payload ->> 'label'),''), btrim(p_payload ->> 'recipientName'), btrim(p_payload ->> 'phoneNumber'),
    btrim(p_payload ->> 'line1'), nullif(btrim(p_payload ->> 'line2'),''), nullif(btrim(p_payload ->> 'landmark'),''),
    btrim(p_payload ->> 'area'), btrim(p_payload ->> 'city'), btrim(p_payload ->> 'state'), btrim(p_payload ->> 'postalCode'),
    'IN', extensions.st_setsrid(extensions.st_makepoint((p_payload ->> 'longitude')::double precision,(p_payload ->> 'latitude')::double precision),4326)::extensions.geography,
    make_default
  ) returning id into new_id;
  if make_default then update public.customer_profiles set default_address_id = new_id where user_id = actor_id; end if;
  result := private.customer_address_json(new_id,actor_id);
  result := private.complete_customer_address_command(actor_id,p_idempotency_key,'CREATE',request_hash,result);
  return query select result;
end;
$$;

create or replace function public.update_customer_address(p_address_id uuid, p_payload jsonb, p_idempotency_key uuid)
returns table(address jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_active_customer_address_actor();
  request_hash text := md5(p_address_id::text || ':' || p_payload::text);
  replay jsonb;
  current_address public.addresses;
  make_default boolean := coalesce((p_payload ->> 'isDefault')::boolean,false);
  result jsonb;
begin
  perform private.validate_customer_address_payload(p_payload, true);
  replay := private.claim_customer_address_command(actor_id,p_idempotency_key,'UPDATE',request_hash);
  if replay is not null then return query select replay; return; end if;
  select * into current_address from public.addresses where id = p_address_id and user_id = actor_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'address not found'; end if;
  if p_payload ? 'isDefault' and not make_default and current_address.is_default then
    raise exception using errcode = 'P0001', message = 'select another default address first';
  end if;
  if make_default then update public.addresses set is_default = false where user_id = actor_id and id <> p_address_id and is_default; end if;
  update public.addresses set
    label = case when p_payload ? 'label' then nullif(btrim(p_payload ->> 'label'),'') else label end,
    recipient_name = case when p_payload ? 'recipientName' then btrim(p_payload ->> 'recipientName') else recipient_name end,
    phone_number = case when p_payload ? 'phoneNumber' then btrim(p_payload ->> 'phoneNumber') else phone_number end,
    line1 = case when p_payload ? 'line1' then btrim(p_payload ->> 'line1') else line1 end,
    line2 = case when p_payload ? 'line2' then nullif(btrim(p_payload ->> 'line2'),'') else line2 end,
    landmark = case when p_payload ? 'landmark' then nullif(btrim(p_payload ->> 'landmark'),'') else landmark end,
    area = case when p_payload ? 'area' then btrim(p_payload ->> 'area') else area end,
    city = case when p_payload ? 'city' then btrim(p_payload ->> 'city') else city end,
    state = case when p_payload ? 'state' then btrim(p_payload ->> 'state') else state end,
    postal_code = case when p_payload ? 'postalCode' then btrim(p_payload ->> 'postalCode') else postal_code end,
    country_code = case when p_payload ? 'countryCode' then 'IN' else country_code end,
    location = case when p_payload ? 'latitude' or p_payload ? 'longitude' then extensions.st_setsrid(extensions.st_makepoint(coalesce((p_payload ->> 'longitude')::double precision,extensions.st_x(location::extensions.geometry)),coalesce((p_payload ->> 'latitude')::double precision,extensions.st_y(location::extensions.geometry))),4326)::extensions.geography else location end,
    is_default = case when p_payload ? 'isDefault' then make_default else is_default end
  where id = p_address_id and user_id = actor_id;
  if make_default then update public.customer_profiles set default_address_id = p_address_id where user_id = actor_id; end if;
  result := private.customer_address_json(p_address_id,actor_id);
  result := private.complete_customer_address_command(actor_id,p_idempotency_key,'UPDATE',request_hash,result);
  return query select result;
end;
$$;

create or replace function public.set_customer_default_address(p_address_id uuid, p_idempotency_key uuid)
returns table(address jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid := private.require_active_customer_address_actor(); request_hash text := md5(p_address_id::text); replay jsonb; result jsonb;
begin
  replay := private.claim_customer_address_command(actor_id,p_idempotency_key,'DEFAULT',request_hash);
  if replay is not null then return query select replay; return; end if;
  if not exists(select 1 from public.addresses where id=p_address_id and user_id=actor_id) then raise exception using errcode='P0002',message='address not found'; end if;
  update public.addresses set is_default = (id = p_address_id) where user_id = actor_id and (is_default or id = p_address_id);
  update public.customer_profiles set default_address_id = p_address_id where user_id = actor_id;
  result := private.customer_address_json(p_address_id,actor_id);
  result := private.complete_customer_address_command(actor_id,p_idempotency_key,'DEFAULT',request_hash,result);
  return query select result;
end;
$$;

create or replace function public.delete_customer_address(p_address_id uuid, p_idempotency_key uuid)
returns table(result jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_active_customer_address_actor();
  request_hash text := md5(p_address_id::text);
  replay jsonb;
  was_default boolean;
  next_default uuid;
  response_value jsonb;
begin
  replay := private.claim_customer_address_command(actor_id,p_idempotency_key,'DELETE',request_hash);
  if replay is not null then return query select replay; return; end if;
  select is_default into was_default from public.addresses where id=p_address_id and user_id=actor_id for update;
  if not found then raise exception using errcode='P0002',message='address not found'; end if;
  delete from public.addresses where id=p_address_id and user_id=actor_id;
  if was_default then
    select id into next_default from public.addresses where user_id=actor_id order by created_at asc,id asc limit 1 for update;
    if next_default is not null then update public.addresses set is_default=true where id=next_default; end if;
    update public.customer_profiles set default_address_id=next_default where user_id=actor_id;
  else
    select default_address_id into next_default from public.customer_profiles where user_id=actor_id;
  end if;
  response_value := jsonb_build_object('deletedAddressId',p_address_id,'defaultAddressId',next_default);
  response_value := private.complete_customer_address_command(actor_id,p_idempotency_key,'DELETE',request_hash,response_value);
  return query select response_value;
end;
$$;

revoke all on function public.list_customer_addresses() from public, anon;
revoke all on function public.get_customer_address(uuid) from public, anon;
revoke all on function public.create_customer_address(jsonb,uuid) from public, anon;
revoke all on function public.update_customer_address(uuid,jsonb,uuid) from public, anon;
revoke all on function public.set_customer_default_address(uuid,uuid) from public, anon;
revoke all on function public.delete_customer_address(uuid,uuid) from public, anon;
grant execute on function public.list_customer_addresses() to authenticated, service_role;
grant execute on function public.get_customer_address(uuid) to authenticated, service_role;
grant execute on function public.create_customer_address(jsonb,uuid) to authenticated, service_role;
grant execute on function public.update_customer_address(uuid,jsonb,uuid) to authenticated, service_role;
grant execute on function public.set_customer_default_address(uuid,uuid) to authenticated, service_role;
grant execute on function public.delete_customer_address(uuid,uuid) to authenticated, service_role;
