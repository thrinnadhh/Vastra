-- S5A-05: transactional owner-scoped Saved Look lifecycle.

create table public.saved_looks (
  id uuid primary key default gen_random_uuid(),
  owner_customer_id uuid not null references public.customer_profiles (user_id)
    on update cascade on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_looks_name_check check (length(btrim(name)) between 1 and 120)
);

create table public.saved_look_items (
  id uuid primary key default gen_random_uuid(),
  look_id uuid not null references public.saved_looks (id) on update cascade on delete cascade,
  item_type text not null,
  wardrobe_item_id uuid references public.wardrobe_items (id) on update cascade on delete restrict,
  product_variant_id uuid references public.product_variants (id) on update cascade on delete restrict,
  display_position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_look_items_type_check check (item_type in ('WARDROBE_ITEM','PRODUCT_VARIANT')),
  constraint saved_look_items_source_xor_check check (
    (item_type='WARDROBE_ITEM' and wardrobe_item_id is not null and product_variant_id is null)
    or
    (item_type='PRODUCT_VARIANT' and product_variant_id is not null and wardrobe_item_id is null)
  ),
  constraint saved_look_items_position_check check (display_position >= 0),
  constraint saved_look_items_look_position_key unique (look_id, display_position)
);

create index saved_looks_owner_updated_idx on public.saved_looks (owner_customer_id, updated_at desc, id desc);
create index saved_look_items_look_position_idx on public.saved_look_items (look_id, display_position);
create index saved_look_items_wardrobe_idx on public.saved_look_items (wardrobe_item_id) where wardrobe_item_id is not null;

alter table public.saved_looks enable row level security;
alter table public.saved_looks force row level security;
alter table public.saved_look_items enable row level security;
alter table public.saved_look_items force row level security;

create policy saved_looks_owner_select on public.saved_looks for select to authenticated
using (owner_customer_id = (select auth.uid()));
create policy saved_look_items_owner_select on public.saved_look_items for select to authenticated
using (exists (
  select 1 from public.saved_looks look
  where look.id = saved_look_items.look_id and look.owner_customer_id = (select auth.uid())
));
revoke insert,update,delete on public.saved_looks,public.saved_look_items from authenticated;
grant select on public.saved_looks,public.saved_look_items to authenticated;
grant all on public.saved_looks,public.saved_look_items to service_role;

create table private.saved_look_create_requests (
  customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  idempotency_key uuid not null,
  request_payload jsonb not null,
  look_id uuid references public.saved_looks(id) on delete set null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(customer_id,idempotency_key)
);
create table private.saved_look_delete_requests (
  customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  idempotency_key uuid not null,
  look_id uuid not null,
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(customer_id,idempotency_key)
);
revoke all privileges on private.saved_look_create_requests,private.saved_look_delete_requests
from public,anon,authenticated,service_role;

create or replace function private.build_saved_look_payload(p_look_id uuid)
returns jsonb language sql security definer stable set search_path=''
as $$
  select jsonb_build_object(
    'id', look.id,
    'ownerCustomerId', look.owner_customer_id,
    'name', look.name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'sourceType', item.item_type,
        'wardrobeItemId', item.wardrobe_item_id,
        'productVariantId', item.product_variant_id,
        'displayPosition', item.display_position,
        'currentSellingPricePaise', null,
        'availableQuantity', null,
        'imageUrl', null
      ) order by item.display_position)
      from public.saved_look_items item where item.look_id=look.id
    ),'[]'::jsonb),
    'createdAt',look.created_at,
    'updatedAt',look.updated_at
  ) from public.saved_looks look where look.id=p_look_id;
$$;
revoke all on function private.build_saved_look_payload(uuid) from public,anon,authenticated;
grant execute on function private.build_saved_look_payload(uuid) to service_role;

create or replace function private.validate_saved_look_items(p_actor uuid,p_items jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare entry jsonb; source_id uuid; source_type text;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'saved look items invalid' using errcode='P0031';
  end if;
  for entry in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(entry)<>'object' then raise exception 'saved look item invalid' using errcode='P0031'; end if;
    source_type:=entry->>'sourceType';
    if source_type='WARDROBE_ITEM' then
      if entry->>'wardrobeItemId' is null or entry->>'productVariantId' is not null then
        raise exception 'saved look wardrobe source invalid' using errcode='P0031';
      end if;
      begin source_id:=(entry->>'wardrobeItemId')::uuid; exception when others then
        raise exception 'saved look wardrobe source invalid' using errcode='P0031'; end;
      perform 1 from public.wardrobe_items wardrobe
      where wardrobe.id=source_id and wardrobe.owner_customer_id=p_actor and wardrobe.status='ACTIVE'
      for share;
      if not found then raise exception 'saved look source unavailable' using errcode='P0032'; end if;
    elsif source_type='PRODUCT_VARIANT' then
      if entry->>'productVariantId' is null or entry->>'wardrobeItemId' is not null then
        raise exception 'saved look product source invalid' using errcode='P0031';
      end if;
      begin source_id:=(entry->>'productVariantId')::uuid; exception when others then
        raise exception 'saved look product source invalid' using errcode='P0031'; end;
      perform 1 from public.product_variants variant
      join public.products product on product.id=variant.product_id
      where variant.id=source_id and variant.is_active and product.is_active and product.deleted_at is null
      for share of variant,product;
      if not found then raise exception 'saved look source unavailable' using errcode='P0032'; end if;
    else
      raise exception 'saved look item type invalid' using errcode='P0031';
    end if;
  end loop;
end;
$$;

create or replace function private.replace_saved_look_items(p_look_id uuid,p_actor uuid,p_items jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare entry jsonb; position integer:=0;
begin
  perform private.validate_saved_look_items(p_actor,p_items);
  delete from public.saved_look_items item where item.look_id=p_look_id;
  for entry in select value from jsonb_array_elements(p_items) loop
    insert into public.saved_look_items(look_id,item_type,wardrobe_item_id,product_variant_id,display_position)
    values(
      p_look_id,
      entry->>'sourceType',
      case when entry->>'sourceType'='WARDROBE_ITEM' then (entry->>'wardrobeItemId')::uuid else null end,
      case when entry->>'sourceType'='PRODUCT_VARIANT' then (entry->>'productVariantId')::uuid else null end,
      position
    );
    position:=position+1;
  end loop;
end;
$$;

create or replace function public.create_saved_look(p_actor uuid,p_name text,p_items jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  normalized_name text:=btrim(coalesce(p_name,''));
  request_payload jsonb;
  request_row private.saved_look_create_requests;
  look_row public.saved_looks;
  result jsonb;
begin
  if p_actor is null or p_idempotency_key is null or length(normalized_name) not between 1 and 120 then
    raise exception 'saved look request invalid' using errcode='22023';
  end if;
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  perform 1 from public.customer_profiles customer where customer.user_id=p_actor for update;
  request_payload:=jsonb_build_object('name',normalized_name,'items',p_items);
  insert into private.saved_look_create_requests(customer_id,idempotency_key,request_payload)
  values(p_actor,p_idempotency_key,request_payload)
  on conflict(customer_id,idempotency_key) do nothing returning * into request_row;
  if not found then
    select * into strict request_row from private.saved_look_create_requests request
    where request.customer_id=p_actor and request.idempotency_key=p_idempotency_key for update;
    if request_row.request_payload<>request_payload then raise exception 'idempotency conflict' using errcode='P0010'; end if;
    if request_row.result_payload is null then raise exception 'incomplete look receipt' using errcode='55000'; end if;
    return request_row.result_payload;
  end if;
  perform private.validate_saved_look_items(p_actor,p_items);
  insert into public.saved_looks(owner_customer_id,name) values(p_actor,normalized_name) returning * into look_row;
  perform private.replace_saved_look_items(look_row.id,p_actor,p_items);
  result:=private.build_saved_look_payload(look_row.id);
  update private.saved_look_create_requests request set look_id=look_row.id,result_payload=result,completed_at=statement_timestamp()
  where request.customer_id=p_actor and request.idempotency_key=p_idempotency_key;
  return result;
end;
$$;

create or replace function public.get_saved_look(p_actor uuid,p_look_id uuid)
returns jsonb language plpgsql security definer stable set search_path=''
as $$
begin
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  perform 1 from public.saved_looks look where look.id=p_look_id and look.owner_customer_id=p_actor;
  if not found then raise exception 'saved look not found' using errcode='P0030'; end if;
  return private.build_saved_look_payload(p_look_id);
end;
$$;

create or replace function public.list_saved_looks(p_actor uuid,p_cursor_updated_at timestamptz default null,p_cursor_id uuid default null,p_limit integer default 20)
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare result jsonb;
begin
  if p_actor is null or p_limit not between 1 and 100 or ((p_cursor_updated_at is null)<>(p_cursor_id is null)) then
    raise exception 'saved look list invalid' using errcode='22023';
  end if;
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  with page as (
    select look.* from public.saved_looks look where look.owner_customer_id=p_actor
      and (p_cursor_updated_at is null or (look.updated_at,look.id)<(p_cursor_updated_at,p_cursor_id))
    order by look.updated_at desc,look.id desc limit p_limit+1
  ), visible as (select * from page order by updated_at desc,id desc limit p_limit),
  last_visible as (select * from visible order by updated_at asc,id asc limit 1)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(private.build_saved_look_payload(id) order by updated_at desc,id desc) from visible),'[]'::jsonb),
    'nextCursor',case when (select count(*) from page)>p_limit
      then (select jsonb_build_object('updatedAt',updated_at,'id',id) from last_visible)
      else null end
  ) into result;
  return result;
end;
$$;

create or replace function public.update_saved_look(p_actor uuid,p_look_id uuid,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare look_row public.saved_looks; normalized_name text;
begin
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb
    or exists(select 1 from jsonb_object_keys(p_patch) key where key not in('name','items')) then
    raise exception 'saved look update invalid' using errcode='22023';
  end if;
  select * into look_row from public.saved_looks look where look.id=p_look_id and look.owner_customer_id=p_actor for update;
  if not found then raise exception 'saved look not found' using errcode='P0030'; end if;
  if p_patch?'name' then
    normalized_name:=btrim(coalesce(p_patch->>'name',''));
    if length(normalized_name) not between 1 and 120 then raise exception 'saved look name invalid' using errcode='22023'; end if;
    update public.saved_looks look set name=normalized_name where look.id=look_row.id;
  end if;
  if p_patch?'items' then perform private.replace_saved_look_items(look_row.id,p_actor,p_patch->'items'); end if;
  update public.saved_looks look set updated_at=statement_timestamp() where look.id=look_row.id;
  return private.build_saved_look_payload(look_row.id);
end;
$$;

create or replace function public.delete_saved_look(p_actor uuid,p_look_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  request_payload jsonb:=jsonb_build_object('lookId',p_look_id);
  request_row private.saved_look_delete_requests;
  result jsonb:=jsonb_build_object('success',true);
begin
  if p_actor is null or p_look_id is null or p_idempotency_key is null then raise exception 'delete look invalid' using errcode='22023'; end if;
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  perform 1 from public.customer_profiles customer where customer.user_id=p_actor for update;
  insert into private.saved_look_delete_requests(customer_id,idempotency_key,look_id,request_payload)
  values(p_actor,p_idempotency_key,p_look_id,request_payload)
  on conflict(customer_id,idempotency_key) do nothing returning * into request_row;
  if not found then
    select * into strict request_row from private.saved_look_delete_requests request
    where request.customer_id=p_actor and request.idempotency_key=p_idempotency_key for update;
    if request_row.request_payload<>request_payload then raise exception 'idempotency conflict' using errcode='P0010'; end if;
    if request_row.result_payload is null then raise exception 'incomplete delete receipt' using errcode='55000'; end if;
    return request_row.result_payload;
  end if;
  perform 1 from public.saved_looks look where look.id=p_look_id and look.owner_customer_id=p_actor for update;
  if not found then raise exception 'saved look not found' using errcode='P0030'; end if;
  delete from public.saved_looks look where look.id=p_look_id;
  update private.saved_look_delete_requests request set result_payload=result,completed_at=statement_timestamp()
  where request.customer_id=p_actor and request.idempotency_key=p_idempotency_key;
  return result;
end;
$$;

create or replace function private.remove_deleted_wardrobe_from_looks()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if old.status='ACTIVE' and new.status='DELETED' then
    delete from public.saved_look_items item where item.wardrobe_item_id=old.id;
  end if;
  return new;
end;
$$;
create trigger wardrobe_item_delete_saved_look_refs
before update of status on public.wardrobe_items
for each row execute function private.remove_deleted_wardrobe_from_looks();

revoke all on function private.validate_saved_look_items(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.replace_saved_look_items(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.create_saved_look(uuid,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_saved_look(uuid,uuid) from public,anon,authenticated;
revoke all on function public.list_saved_looks(uuid,timestamptz,uuid,integer) from public,anon,authenticated;
revoke all on function public.update_saved_look(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.delete_saved_look(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.validate_saved_look_items(uuid,jsonb) to service_role;
grant execute on function private.replace_saved_look_items(uuid,uuid,jsonb) to service_role;
grant execute on function public.create_saved_look(uuid,text,jsonb,uuid) to service_role;
grant execute on function public.get_saved_look(uuid,uuid) to service_role;
grant execute on function public.list_saved_looks(uuid,timestamptz,uuid,integer) to service_role;
grant execute on function public.update_saved_look(uuid,uuid,jsonb) to service_role;
grant execute on function public.delete_saved_look(uuid,uuid,uuid) to service_role;
