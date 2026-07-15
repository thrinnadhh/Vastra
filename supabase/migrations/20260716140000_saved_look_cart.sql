-- S5A-08: atomically add a selected same-shop Saved Look product set to the cart.

create table private.saved_look_cart_requests (
  customer_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  idempotency_key uuid not null,
  look_id uuid not null,
  request_payload jsonb not null,
  cart_id uuid references public.carts(id) on delete restrict,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(customer_id,idempotency_key)
);
revoke all privileges on private.saved_look_cart_requests from public,anon,authenticated,service_role;

create or replace function public.add_saved_look_products_to_cart(
  p_actor uuid,
  p_look_id uuid,
  p_variant_ids uuid[],
  p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  normalized_ids uuid[];
  request_payload jsonb;
  request_row private.saved_look_cart_requests;
  selected_shop_id uuid;
  cart_row public.carts;
  variant_row record;
  existing_item public.cart_items;
  effective_available bigint;
  next_quantity integer;
  result jsonb;
begin
  if p_actor is null or p_look_id is null or p_idempotency_key is null
    or p_variant_ids is null or cardinality(p_variant_ids) not between 1 and 50 then
    raise exception 'look cart request invalid' using errcode='22023';
  end if;
  select array_agg(value order by value) into normalized_ids
  from (select distinct value from unnest(p_variant_ids) value) normalized;
  if cardinality(normalized_ids)<>cardinality(p_variant_ids) then
    raise exception 'variant IDs must be unique' using errcode='22023';
  end if;

  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  perform 1 from public.customer_profiles customer where customer.user_id=p_actor for update;

  request_payload:=jsonb_build_object('lookId',p_look_id,'productVariantIds',to_jsonb(normalized_ids));
  insert into private.saved_look_cart_requests(customer_id,idempotency_key,look_id,request_payload)
  values(p_actor,p_idempotency_key,p_look_id,request_payload)
  on conflict(customer_id,idempotency_key) do nothing returning * into request_row;
  if not found then
    select * into strict request_row from private.saved_look_cart_requests request
    where request.customer_id=p_actor and request.idempotency_key=p_idempotency_key for update;
    if request_row.request_payload<>request_payload then raise exception 'idempotency conflict' using errcode='P0010'; end if;
    if request_row.result_payload is null then raise exception 'incomplete look cart receipt' using errcode='55000'; end if;
    return request_row.result_payload;
  end if;

  perform 1 from public.saved_looks look where look.id=p_look_id and look.owner_customer_id=p_actor for share;
  if not found then raise exception 'saved look not found' using errcode='P0030'; end if;

  if (select count(distinct item.product_variant_id) from public.saved_look_items item
      where item.look_id=p_look_id and item.item_type='PRODUCT_VARIANT' and item.product_variant_id=any(normalized_ids))
     <> cardinality(normalized_ids) then
    raise exception 'requested product is not in the look' using errcode='P0031';
  end if;

  select variant.shop_id into selected_shop_id
  from public.product_variants variant
  where variant.id=any(normalized_ids)
  order by variant.id
  limit 1;
  if selected_shop_id is null
    or (select count(distinct variant.shop_id) from public.product_variants variant where variant.id=any(normalized_ids))<>1 then
    raise exception 'selected variants span shops' using errcode='P0003';
  end if;

  select * into cart_row from public.carts cart
  where cart.customer_id=p_actor and cart.status='ACTIVE'
  order by cart.created_at desc,cart.id limit 1 for update;
  if found and cart_row.shop_id<>selected_shop_id then
    raise exception 'active cart belongs to another shop' using errcode='P0003';
  end if;
  if cart_row.id is null then
    insert into public.carts(customer_id,shop_id,status)
    values(p_actor,selected_shop_id,'ACTIVE') returning * into cart_row;
  end if;

  for variant_row in
    select
      variant.id,variant.shop_id,variant.selling_price_paise,variant.is_active as variant_active,
      product.is_active as product_active,product.deleted_at,product.moderation_status,
      shop.verification_status,shop.operational_status,shop.accepts_online_orders,
      balance.stock_on_hand,balance.reserved_quantity,balance.damaged_quantity
    from public.product_variants variant
    join public.products product on product.id=variant.product_id and product.shop_id=variant.shop_id
    join public.shops shop on shop.id=variant.shop_id
    join public.inventory_balances balance on balance.shop_id=variant.shop_id and balance.variant_id=variant.id
    where variant.id=any(normalized_ids)
    order by variant.id
    for update of variant,product,shop,balance
  loop
    if not variant_row.variant_active or not variant_row.product_active or variant_row.deleted_at is not null
      or variant_row.moderation_status<>'APPROVED' or variant_row.verification_status<>'VERIFIED'
      or variant_row.operational_status not in('OPEN','BUSY') or not variant_row.accepts_online_orders then
      raise exception 'selected variant unavailable' using errcode='P0005';
    end if;

    select * into existing_item from public.cart_items item
    where item.cart_id=cart_row.id and item.variant_id=variant_row.id for update;
    next_quantity:=coalesce(existing_item.quantity,0)+1;
    if next_quantity>20 then raise exception 'cart quantity limit exceeded' using errcode='P0004'; end if;

    select greatest(
      variant_row.stock_on_hand-variant_row.reserved_quantity-variant_row.damaged_quantity,
      0
    ) + coalesce((
      select sum(reservation.quantity)::bigint from public.inventory_reservations reservation
      where reservation.cart_id=cart_row.id and reservation.variant_id=variant_row.id and reservation.status='ACTIVE'
    ),0) into effective_available;
    if effective_available<next_quantity then raise exception 'selected variant lacks stock' using errcode='P0004'; end if;

    if existing_item.id is not null then
      perform private.release_customer_cart_reservations(
        cart_row.id,p_actor,'Saved Look product added to cart',variant_row.id
      );
    end if;

    insert into public.cart_items(cart_id,shop_id,variant_id,quantity,unit_price_snapshot_paise)
    values(cart_row.id,variant_row.shop_id,variant_row.id,next_quantity,variant_row.selling_price_paise)
    on conflict on constraint cart_items_cart_variant_key do update
    set quantity=excluded.quantity,unit_price_snapshot_paise=excluded.unit_price_snapshot_paise;
  end loop;

  if (select count(*) from public.product_variants variant
      join public.inventory_balances balance on balance.variant_id=variant.id and balance.shop_id=variant.shop_id
      where variant.id=any(normalized_ids))<>cardinality(normalized_ids) then
    raise exception 'selected variant lacks inventory' using errcode='P0004';
  end if;

  result:=jsonb_build_object('cartId',cart_row.id,'addedVariantIds',to_jsonb(normalized_ids));
  update private.saved_look_cart_requests request
  set cart_id=cart_row.id,result_payload=result,completed_at=statement_timestamp()
  where request.customer_id=p_actor and request.idempotency_key=p_idempotency_key;
  return result;
end;
$$;
revoke all on function public.add_saved_look_products_to_cart(uuid,uuid,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.add_saved_look_products_to_cart(uuid,uuid,uuid[],uuid) to service_role;
