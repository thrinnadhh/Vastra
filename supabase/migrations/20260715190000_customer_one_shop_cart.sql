-- S4-06: backend-mediated one-shop customer cart.
--
-- Cart mutations serialize on the customer profile, preserve one active cart,
-- require explicit confirmation before replacing another shop's cart, and
-- invalidate active inventory reservations whenever a cart line is changed or
-- removed. Read payloads hydrate current catalogue price and live availability
-- without exposing inventory internals.

create or replace function private.build_customer_cart_payload(
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  cart_row public.carts;
  items_payload jsonb;
  item_count bigint;
  subtotal_paise bigint;
  current_subtotal_paise bigint;
  has_price_changes boolean;
  has_unavailable_items boolean;
begin
  if p_customer_id is null then
    return jsonb_build_object('cart', null);
  end if;

  select cart.*
  into cart_row
  from public.carts cart
  where cart.customer_id = p_customer_id
    and cart.status = 'ACTIVE'
  order by cart.created_at desc, cart.id
  limit 1;

  if not found then
    return jsonb_build_object('cart', null);
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'variantId', variant.id,
          'productId', product.id,
          'productName', product.name,
          'productSlug', product.slug,
          'sku', variant.sku,
          'colourName', variant.colour_name,
          'sizeLabel', variant.size_label,
          'imageObjectKey', image.image_object_key,
          'quantity', item.quantity,
          'unitPricePaise', item.unit_price_snapshot_paise,
          'currentUnitPricePaise', variant.selling_price_paise,
          'priceChanged',
            item.unit_price_snapshot_paise
              <> variant.selling_price_paise,
          'availableQuantity',
            greatest(
              coalesce(
                balance.stock_on_hand
                  - balance.reserved_quantity
                  - balance.damaged_quantity,
                0
              )
              + coalesce(owned_reservation.quantity, 0),
              0
            ),
          'isAvailable',
            shop.verification_status = 'VERIFIED'
            and shop.operational_status in ('OPEN', 'BUSY')
            and shop.accepts_online_orders
            and product.moderation_status = 'APPROVED'
            and product.is_active
            and product.deleted_at is null
            and variant.is_active
            and greatest(
              coalesce(
                balance.stock_on_hand
                  - balance.reserved_quantity
                  - balance.damaged_quantity,
                0
              )
              + coalesce(owned_reservation.quantity, 0),
              0
            ) >= item.quantity,
          'lineTotalPaise',
            item.quantity::bigint
              * item.unit_price_snapshot_paise,
          'currentLineTotalPaise',
            item.quantity::bigint
              * variant.selling_price_paise,
          'addedAt', item.added_at,
          'updatedAt', item.updated_at
        )
        order by item.added_at, item.id
      ),
      '[]'::jsonb
    ),
    coalesce(sum(item.quantity::bigint), 0),
    coalesce(
      sum(
        item.quantity::bigint
          * item.unit_price_snapshot_paise
      ),
      0
    ),
    coalesce(
      sum(
        item.quantity::bigint
          * variant.selling_price_paise
      ),
      0
    ),
    coalesce(
      bool_or(
        item.unit_price_snapshot_paise
          <> variant.selling_price_paise
      ),
      false
    ),
    coalesce(
      bool_or(
        not (
          shop.verification_status = 'VERIFIED'
          and shop.operational_status in ('OPEN', 'BUSY')
          and shop.accepts_online_orders
          and product.moderation_status = 'APPROVED'
          and product.is_active
          and product.deleted_at is null
          and variant.is_active
          and greatest(
            coalesce(
              balance.stock_on_hand
                - balance.reserved_quantity
                - balance.damaged_quantity,
              0
            )
            + coalesce(owned_reservation.quantity, 0),
            0
          ) >= item.quantity
        )
      ),
      false
    )
  into
    items_payload,
    item_count,
    subtotal_paise,
    current_subtotal_paise,
    has_price_changes,
    has_unavailable_items
  from public.cart_items item
  join public.product_variants variant
    on variant.id = item.variant_id
  join public.products product
    on product.id = variant.product_id
  join public.shops shop
    on shop.id = item.shop_id
  left join public.inventory_balances balance
    on balance.shop_id = item.shop_id
   and balance.variant_id = item.variant_id
  left join lateral (
    select sum(reservation.quantity)::bigint as quantity
    from public.inventory_reservations reservation
    where reservation.cart_id = item.cart_id
      and reservation.variant_id = item.variant_id
      and reservation.status = 'ACTIVE'
  ) owned_reservation on true
  left join lateral (
    select coalesce(
      product_image.thumbnail_object_key,
      product_image.storage_object_key
    ) as image_object_key
    from public.product_images product_image
    where product_image.product_id = product.id
      and (
        product_image.variant_id = variant.id
        or product_image.variant_id is null
      )
    order by
      (product_image.variant_id = variant.id) desc,
      product_image.is_primary desc,
      product_image.display_order,
      product_image.id
    limit 1
  ) image on true
  where item.cart_id = cart_row.id;

  return jsonb_build_object(
    'cart',
    jsonb_build_object(
      'id', cart_row.id,
      'shop',
        jsonb_build_object(
          'id', cart_row.shop_id,
          'name', (
            select shop.name
            from public.shops shop
            where shop.id = cart_row.shop_id
          ),
          'slug', (
            select shop.slug
            from public.shops shop
            where shop.id = cart_row.shop_id
          ),
          'logoObjectKey', (
            select shop.logo_object_key
            from public.shops shop
            where shop.id = cart_row.shop_id
          ),
          'operationalStatus', (
            select shop.operational_status
            from public.shops shop
            where shop.id = cart_row.shop_id
          ),
          'acceptsOnlineOrders', (
            select shop.accepts_online_orders
            from public.shops shop
            where shop.id = cart_row.shop_id
          )
        ),
      'items', items_payload,
      'itemCount', item_count,
      'subtotalPaise', subtotal_paise,
      'currentSubtotalPaise', current_subtotal_paise,
      'hasPriceChanges', has_price_changes,
      'hasUnavailableItems', has_unavailable_items,
      'createdAt', cart_row.created_at,
      'updatedAt', cart_row.updated_at
    )
  );
end;
$$;

revoke all
on function private.build_customer_cart_payload(uuid)
from public, anon, authenticated;

grant execute
on function private.build_customer_cart_payload(uuid)
to service_role;

create or replace function private.release_customer_cart_reservations(
  p_cart_id uuid,
  p_actor uuid,
  p_reason text,
  p_variant_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row record;
begin
  for reservation_row in
    select reservation.id
    from public.inventory_reservations reservation
    where reservation.cart_id = p_cart_id
      and reservation.status = 'ACTIVE'
      and (
        p_variant_id is null
        or reservation.variant_id = p_variant_id
      )
    order by reservation.created_at, reservation.id
    for update
  loop
    perform public.release_customer_cart_reservation(
      reservation_row.id,
      p_reason,
      p_actor
    );
  end loop;
end;
$$;

revoke all
on function private.release_customer_cart_reservations(
  uuid,
  uuid,
  text,
  uuid
)
from public, anon, authenticated;

grant execute
on function private.release_customer_cart_reservations(
  uuid,
  uuid,
  text,
  uuid
)
to service_role;

create or replace function public.get_customer_cart()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'authentication is required'
      using errcode = '42501';
  end if;

  return private.build_customer_cart_payload(actor_id);
end;
$$;

create or replace function public.set_customer_cart_item(
  p_actor uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_replace_existing_cart boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := p_actor;
  cart_row public.carts;
  variant_row record;
  existing_item_row public.cart_items;
  effective_available_quantity bigint;
begin
  if actor_id is null then
    raise exception 'authentication is required'
      using errcode = '42501';
  end if;

  if p_variant_id is null
    or p_quantity is null
    or p_quantity < 1
    or p_quantity > 20
    or p_replace_existing_cart is null
  then
    raise exception 'variant, quantity from 1 to 20, and replacement decision are required'
      using errcode = '22023';
  end if;

  perform 1
  from public.customer_profiles customer
  where customer.user_id = actor_id
  for update;

  if not found then
    raise exception 'customer profile not found'
      using errcode = '42501';
  end if;

  select
    variant.id as variant_id,
    variant.product_id,
    variant.shop_id,
    variant.selling_price_paise,
    variant.is_active as variant_is_active,
    product.is_active as product_is_active,
    product.deleted_at,
    product.moderation_status,
    shop.verification_status,
    shop.operational_status,
    shop.accepts_online_orders
  into variant_row
  from public.product_variants variant
  join public.products product
    on product.id = variant.product_id
   and product.shop_id = variant.shop_id
  join public.shops shop
    on shop.id = variant.shop_id
  where variant.id = p_variant_id;

  if not found
    or not variant_row.variant_is_active
    or not variant_row.product_is_active
    or variant_row.deleted_at is not null
    or variant_row.moderation_status <> 'APPROVED'
    or variant_row.verification_status <> 'VERIFIED'
    or variant_row.operational_status not in ('OPEN', 'BUSY')
    or not variant_row.accepts_online_orders
  then
    raise exception 'customer cart variant not found'
      using errcode = 'P0005';
  end if;

  select cart.*
  into cart_row
  from public.carts cart
  where cart.customer_id = actor_id
    and cart.status = 'ACTIVE'
  order by cart.created_at desc, cart.id
  limit 1
  for update;

  if found and cart_row.shop_id <> variant_row.shop_id then
    if not p_replace_existing_cart then
      raise exception 'active cart belongs to another shop'
        using errcode = 'P0003';
    end if;

    perform private.release_customer_cart_reservations(
      cart_row.id,
      actor_id,
      'Customer replaced the active cart',
      null
    );

    delete from public.cart_items item
    where item.cart_id = cart_row.id;

    update public.carts cart
    set status = 'ABANDONED'
    where cart.id = cart_row.id;

    cart_row := null;
  end if;

  if cart_row.id is null then
    insert into public.carts (
      customer_id,
      shop_id,
      status
    )
    values (
      actor_id,
      variant_row.shop_id,
      'ACTIVE'
    )
    returning * into cart_row;
  end if;

  select item.*
  into existing_item_row
  from public.cart_items item
  where item.cart_id = cart_row.id
    and item.variant_id = p_variant_id
  for update;

  select
    greatest(
      coalesce(
        balance.stock_on_hand
          - balance.reserved_quantity
          - balance.damaged_quantity,
        0
      )
      + coalesce(
        (
          select sum(reservation.quantity)::bigint
          from public.inventory_reservations reservation
          where reservation.cart_id = cart_row.id
            and reservation.variant_id = p_variant_id
            and reservation.status = 'ACTIVE'
        ),
        0
      ),
      0
    )
  into effective_available_quantity
  from public.product_variants variant
  left join public.inventory_balances balance
    on balance.shop_id = variant.shop_id
   and balance.variant_id = variant.id
  where variant.id = p_variant_id;

  if effective_available_quantity < p_quantity then
    raise exception 'requested cart quantity is unavailable'
      using errcode = 'P0004';
  end if;

  if existing_item_row.id is not null
    and existing_item_row.quantity <> p_quantity
  then
    perform private.release_customer_cart_reservations(
      cart_row.id,
      actor_id,
      'Cart quantity changed',
      p_variant_id
    );
  end if;

  insert into public.cart_items (
    cart_id,
    shop_id,
    variant_id,
    quantity,
    unit_price_snapshot_paise
  )
  values (
    cart_row.id,
    variant_row.shop_id,
    p_variant_id,
    p_quantity,
    variant_row.selling_price_paise
  )
  on conflict on constraint cart_items_cart_variant_key
  do update
  set quantity = excluded.quantity;

  return private.build_customer_cart_payload(actor_id);
end;
$$;

create or replace function public.update_customer_cart_item(
  p_actor uuid,
  p_cart_item_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := p_actor;
  cart_item_row record;
  effective_available_quantity bigint;
begin
  if actor_id is null then
    raise exception 'authentication is required'
      using errcode = '42501';
  end if;

  if p_cart_item_id is null
    or p_quantity is null
    or p_quantity < 1
    or p_quantity > 20
  then
    raise exception 'cart item and quantity from 1 to 20 are required'
      using errcode = '22023';
  end if;

  perform 1
  from public.customer_profiles customer
  where customer.user_id = actor_id
  for update;

  if not found then
    raise exception 'customer profile not found'
      using errcode = '42501';
  end if;

  select
    item.id,
    item.cart_id,
    item.variant_id,
    item.quantity,
    variant.shop_id,
    variant.is_active as variant_is_active,
    product.is_active as product_is_active,
    product.deleted_at,
    product.moderation_status,
    shop.verification_status,
    shop.operational_status,
    shop.accepts_online_orders
  into cart_item_row
  from public.cart_items item
  join public.carts cart
    on cart.id = item.cart_id
  join public.product_variants variant
    on variant.id = item.variant_id
  join public.products product
    on product.id = variant.product_id
  join public.shops shop
    on shop.id = variant.shop_id
  where item.id = p_cart_item_id
    and cart.customer_id = actor_id
    and cart.status = 'ACTIVE'
  for update of item, cart;

  if not found then
    raise exception 'customer cart item not found'
      using errcode = 'P0002';
  end if;

  if not cart_item_row.variant_is_active
    or not cart_item_row.product_is_active
    or cart_item_row.deleted_at is not null
    or cart_item_row.moderation_status <> 'APPROVED'
    or cart_item_row.verification_status <> 'VERIFIED'
    or cart_item_row.operational_status not in ('OPEN', 'BUSY')
    or not cart_item_row.accepts_online_orders
  then
    raise exception 'customer cart item not found'
      using errcode = 'P0002';
  end if;

  select
    greatest(
      coalesce(
        balance.stock_on_hand
          - balance.reserved_quantity
          - balance.damaged_quantity,
        0
      )
      + coalesce(
        (
          select sum(reservation.quantity)::bigint
          from public.inventory_reservations reservation
          where reservation.cart_id = cart_item_row.cart_id
            and reservation.variant_id = cart_item_row.variant_id
            and reservation.status = 'ACTIVE'
        ),
        0
      ),
      0
    )
  into effective_available_quantity
  from public.product_variants variant
  left join public.inventory_balances balance
    on balance.shop_id = variant.shop_id
   and balance.variant_id = variant.id
  where variant.id = cart_item_row.variant_id;

  if effective_available_quantity < p_quantity then
    raise exception 'requested cart quantity is unavailable'
      using errcode = 'P0004';
  end if;

  if cart_item_row.quantity <> p_quantity then
    perform private.release_customer_cart_reservations(
      cart_item_row.cart_id,
      actor_id,
      'Cart quantity changed',
      cart_item_row.variant_id
    );
  end if;

  update public.cart_items item
  set quantity = p_quantity
  where item.id = cart_item_row.id;

  return private.build_customer_cart_payload(actor_id);
end;
$$;

create or replace function public.remove_customer_cart_item(
  p_actor uuid,
  p_cart_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := p_actor;
  cart_item_row record;
begin
  if actor_id is null then
    raise exception 'authentication is required'
      using errcode = '42501';
  end if;

  if p_cart_item_id is null then
    raise exception 'cart item is required'
      using errcode = '22023';
  end if;

  perform 1
  from public.customer_profiles customer
  where customer.user_id = actor_id
  for update;

  if not found then
    raise exception 'customer profile not found'
      using errcode = '42501';
  end if;

  select
    item.id,
    item.cart_id,
    item.variant_id
  into cart_item_row
  from public.cart_items item
  join public.carts cart
    on cart.id = item.cart_id
  where item.id = p_cart_item_id
    and cart.customer_id = actor_id
    and cart.status = 'ACTIVE'
  for update of item, cart;

  if not found then
    raise exception 'customer cart item not found'
      using errcode = 'P0002';
  end if;

  perform private.release_customer_cart_reservations(
    cart_item_row.cart_id,
    actor_id,
    'Cart item removed',
    cart_item_row.variant_id
  );

  delete from public.cart_items item
  where item.id = cart_item_row.id;

  if not exists (
    select 1
    from public.cart_items item
    where item.cart_id = cart_item_row.cart_id
  ) then
    update public.carts cart
    set status = 'ABANDONED'
    where cart.id = cart_item_row.cart_id;
  end if;

  return private.build_customer_cart_payload(actor_id);
end;
$$;

create or replace function public.clear_customer_cart(
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := p_actor;
  cart_row public.carts;
begin
  if actor_id is null then
    raise exception 'authentication is required'
      using errcode = '42501';
  end if;

  perform 1
  from public.customer_profiles customer
  where customer.user_id = actor_id
  for update;

  if not found then
    raise exception 'customer profile not found'
      using errcode = '42501';
  end if;

  select cart.*
  into cart_row
  from public.carts cart
  where cart.customer_id = actor_id
    and cart.status = 'ACTIVE'
  order by cart.created_at desc, cart.id
  limit 1
  for update;

  if not found then
    return private.build_customer_cart_payload(actor_id);
  end if;

  perform private.release_customer_cart_reservations(
    cart_row.id,
    actor_id,
    'Customer cleared the active cart',
    null
  );

  delete from public.cart_items item
  where item.cart_id = cart_row.id;

  update public.carts cart
  set status = 'ABANDONED'
  where cart.id = cart_row.id;

  return private.build_customer_cart_payload(actor_id);
end;
$$;

revoke insert, update, delete
on table
  public.carts,
  public.cart_items
from authenticated;

revoke all
on function public.get_customer_cart()
from public, anon, authenticated;

revoke all
on function public.set_customer_cart_item(
  uuid,
  uuid,
  integer,
  boolean
)
from public, anon, authenticated;

revoke all
on function public.update_customer_cart_item(
  uuid,
  uuid,
  integer
)
from public, anon, authenticated;

revoke all
on function public.remove_customer_cart_item(uuid, uuid)
from public, anon, authenticated;

revoke all
on function public.clear_customer_cart(uuid)
from public, anon, authenticated;

grant execute
on function public.get_customer_cart()
to authenticated, service_role;

grant execute
on function public.set_customer_cart_item(
  uuid,
  uuid,
  integer,
  boolean
)
to service_role;

grant execute
on function public.update_customer_cart_item(
  uuid,
  uuid,
  integer
)
to service_role;

grant execute
on function public.remove_customer_cart_item(uuid, uuid)
to service_role;

grant execute
on function public.clear_customer_cart(uuid)
to service_role;
