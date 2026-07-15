-- S5A-06: durable, ordered Saved Look duplication.

create table private.saved_look_duplicate_requests (
  customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  idempotency_key uuid not null,
  source_look_id uuid not null,
  request_payload jsonb not null,
  duplicate_look_id uuid references public.saved_looks(id) on delete set null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(customer_id,idempotency_key)
);
revoke all privileges on private.saved_look_duplicate_requests from public,anon,authenticated,service_role;

create or replace function public.duplicate_saved_look(
  p_actor uuid,
  p_source_look_id uuid,
  p_name text,
  p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  source_row public.saved_looks;
  duplicate_row public.saved_looks;
  normalized_name text:=nullif(btrim(coalesce(p_name,'')),'');
  request_payload jsonb;
  request_row private.saved_look_duplicate_requests;
  result jsonb;
begin
  if p_actor is null or p_source_look_id is null or p_idempotency_key is null
    or (normalized_name is not null and length(normalized_name)>120) then
    raise exception 'duplicate look request invalid' using errcode='22023';
  end if;
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  perform 1 from public.customer_profiles customer where customer.user_id=p_actor for update;
  request_payload:=jsonb_build_object('sourceLookId',p_source_look_id,'name',normalized_name);
  insert into private.saved_look_duplicate_requests(customer_id,idempotency_key,source_look_id,request_payload)
  values(p_actor,p_idempotency_key,p_source_look_id,request_payload)
  on conflict(customer_id,idempotency_key) do nothing returning * into request_row;
  if not found then
    select * into strict request_row from private.saved_look_duplicate_requests request
    where request.customer_id=p_actor and request.idempotency_key=p_idempotency_key for update;
    if request_row.request_payload<>request_payload then raise exception 'idempotency conflict' using errcode='P0010'; end if;
    if request_row.result_payload is null then raise exception 'incomplete duplicate receipt' using errcode='55000'; end if;
    return request_row.result_payload;
  end if;
  select * into source_row from public.saved_looks look
  where look.id=p_source_look_id and look.owner_customer_id=p_actor for share;
  if not found then raise exception 'saved look not found' using errcode='P0030'; end if;
  perform 1 from public.saved_look_items item where item.look_id=source_row.id order by item.display_position for share;
  insert into public.saved_looks(owner_customer_id,name)
  values(p_actor,coalesce(normalized_name,source_row.name)) returning * into duplicate_row;
  insert into public.saved_look_items(
    id,look_id,item_type,wardrobe_item_id,product_variant_id,display_position,created_at,updated_at
  )
  select gen_random_uuid(),duplicate_row.id,item.item_type,item.wardrobe_item_id,item.product_variant_id,
    item.display_position,statement_timestamp(),statement_timestamp()
  from public.saved_look_items item where item.look_id=source_row.id order by item.display_position;
  result:=private.build_saved_look_payload(duplicate_row.id);
  update private.saved_look_duplicate_requests request
  set duplicate_look_id=duplicate_row.id,result_payload=result,completed_at=statement_timestamp()
  where request.customer_id=p_actor and request.idempotency_key=p_idempotency_key;
  return result;
end;
$$;
revoke all on function public.duplicate_saved_look(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.duplicate_saved_look(uuid,uuid,text,uuid) to service_role;
