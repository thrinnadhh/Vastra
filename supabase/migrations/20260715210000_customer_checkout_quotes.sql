-- S4-07: customer checkout quote with live price, stock, serviceability, and ETA checks.
--
-- Quote creation serializes with cart mutations through the customer profile lock,
-- reads current catalogue and inventory state, stores an immutable short-lived
-- snapshot, and does not reserve inventory or create an order. The frozen pilot
-- does not yet define delivery, platform, coupon, product-discount, or tax policy,
-- so those amounts are explicitly quoted as zero rather than invented here.

create table public.checkout_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  cart_id uuid not null,
  shop_id uuid not null,
  address_id uuid not null,
  cart_snapshot_hash text not null,
  payload jsonb not null,
  subtotal_paise public.money_paise not null,
  product_discount_paise public.money_paise not null default 0,
  coupon_discount_paise public.money_paise not null default 0,
  delivery_fee_paise public.money_paise not null default 0,
  platform_fee_paise public.money_paise not null default 0,
  tax_paise public.money_paise not null default 0,
  total_paise public.money_paise not null,
  distance_meters public.non_negative_quantity not null,
  estimated_preparation_minutes public.non_negative_quantity not null,
  estimated_travel_minutes public.non_negative_quantity not null,
  estimated_delivery_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint checkout_quotes_cart_customer_shop_fkey
    foreign key (cart_id, customer_id, shop_id)
    references public.carts (id, customer_id, shop_id)
    on update cascade
    on delete restrict,

  constraint checkout_quotes_address_customer_fkey
    foreign key (address_id, customer_id)
    references public.addresses (id, user_id)
    on update cascade
    on delete restrict,

  constraint checkout_quotes_payload_object
    check (jsonb_typeof(payload) = 'object'),

  constraint checkout_quotes_cart_snapshot_hash_format
    check (cart_snapshot_hash ~ '^[0-9a-f]{64}$'),

  constraint checkout_quotes_discounts_within_subtotal
    check (
      product_discount_paise + coupon_discount_paise
      <= subtotal_paise
    ),

  constraint checkout_quotes_total_arithmetic
    check (
      total_paise =
        subtotal_paise
        - product_discount_paise
        - coupon_discount_paise
        + delivery_fee_paise
        + platform_fee_paise
        + tax_paise
    ),

  constraint checkout_quotes_expiry_after_creation
    check (expires_at > created_at),

  constraint checkout_quotes_eta_after_creation
    check (estimated_delivery_at >= created_at)
);

comment on table public.checkout_quotes is
  'Backend-only short-lived checkout snapshots for customer order placement.';

create index checkout_quotes_customer_created_idx
on public.checkout_quotes (customer_id, created_at desc);

create index checkout_quotes_expiry_idx
on public.checkout_quotes (expires_at);

alter table public.checkout_quotes enable row level security;
alter table public.checkout_quotes force row level security;

create policy checkout_quotes_service_role_all
on public.checkout_quotes
for all
to service_role
using (true)
with check (true);

revoke all privileges
on public.checkout_quotes
from public, anon, authenticated;

create or replace function public.create_customer_checkout_quote(
  p_actor uuid,
  p_address_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := p_actor;
  cart_row public.carts;
  address_row public.addresses;
  shop_row public.shops;
  quote_id uuid := gen_random_uuid();
  quote_created_at timestamptz := statement_timestamp();
  quote_expires_at timestamptz;
  quote_estimated_delivery_at timestamptz;
  distance_meters integer;
  estimated_travel_minutes integer;
  items_payload jsonb;
  item_rows integer;
  subtotal_paise bigint;
  has_unavailable_items boolean;
  quote_payload jsonb;
  cart_snapshot_hash text;
begin
  if actor_id is null or p_address_id is null then
    raise exception 'actor and address are required'
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

  select cart.*
  into cart_row
  from public.carts cart
  where cart.customer_id = actor_id
    and cart.status = 'ACTIVE'
  order by cart.created_at desc, cart.id
  limit 1
  for update;

  if not found then
    raise exception 'active customer cart not found'
      using errcode = 'P0002';
  end if;

  select address.*
  into address_row
  from public.addresses address
  where address.id = p_address_id
    and address.user_id = actor_id;

  if not found then
    raise exception 'customer address not found'
      using errcode = 'P0006';
  end if;

  select shop.*
  into shop_row
  from public.shops shop
  where shop.id = cart_row.shop_id
    and shop.deleted_at is null;

  if not found
    or shop_row.verification_status <> 'VERIFIED'
    or shop_row.operational_status not in ('OPEN', 'BUSY')
    or not shop_row.accepts_online_orders
  then
    raise exception 'shop is not accepting checkout'
      using errcode = 'P0007';
  end if;

  distance_meters := round(
    extensions.st_distance(
      shop_row.location,
      address_row.location
    )
  )::integer;

  if distance_meters > shop_row.service_radius_meters then
    raise exception 'address is outside the shop service area'
      using errcode = 'P0008';
  end if;

  perform 1
  from public.cart_items item
  where item.cart_id = cart_row.id
  order by item.id
  for share;

  if not found then
    raise exception 'active customer cart is empty'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.inventory_balances balance
  join public.cart_items item
    on item.shop_id = balance.shop_id
   and item.variant_id = balance.variant_id
  where item.cart_id = cart_row.id
  order by balance.id
  for share of balance;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'cartItemId', item.id,
          'variantId', variant.id,
          'productId', product.id,
          'productName', product.name,
          'sku', variant.sku,
          'colourName', variant.colour_name,
          'sizeLabel', variant.size_label,
          'quantity', item.quantity,
          'previousUnitPricePaise',
            item.unit_price_snapshot_paise,
          'unitPricePaise', variant.selling_price_paise,
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
          'inventoryVersion', coalesce(balance.version, 1),
          'lineTotalPaise',
            item.quantity::bigint
              * variant.selling_price_paise
        )
        order by item.added_at, item.id
      ),
      '[]'::jsonb
    ),
    count(*)::integer,
    coalesce(
      sum(
        item.quantity::bigint
          * variant.selling_price_paise
      ),
      0
    ),
    coalesce(
      bool_or(
        not (
          product.moderation_status = 'APPROVED'
          and product.is_active
          and product.deleted_at is null
          and variant.is_active
          and balance.id is not null
          and greatest(
            balance.stock_on_hand
              - balance.reserved_quantity
              - balance.damaged_quantity
              + coalesce(owned_reservation.quantity, 0),
            0
          ) >= item.quantity
        )
      ),
      false
    )
  into
    items_payload,
    item_rows,
    subtotal_paise,
    has_unavailable_items
  from public.cart_items item
  join public.product_variants variant
    on variant.id = item.variant_id
   and variant.shop_id = item.shop_id
  join public.products product
    on product.id = variant.product_id
   and product.shop_id = variant.shop_id
  left join public.inventory_balances balance
    on balance.shop_id = item.shop_id
   and balance.variant_id = item.variant_id
  left join lateral (
    select sum(reservation.quantity)::bigint as quantity
    from public.inventory_reservations reservation
    where reservation.cart_id = item.cart_id
      and reservation.variant_id = item.variant_id
      and reservation.status = 'ACTIVE'
      and reservation.expires_at > quote_created_at
  ) owned_reservation on true
  where item.cart_id = cart_row.id;

  if item_rows = 0 then
    raise exception 'active customer cart is empty'
      using errcode = 'P0002';
  end if;

  if has_unavailable_items then
    raise exception 'one or more cart quantities are unavailable'
      using errcode = 'P0014';
  end if;

  if subtotal_paise < shop_row.minimum_order_paise then
    raise exception 'minimum order amount is not met'
      using errcode = 'P0009';
  end if;

  cart_snapshot_hash := encode(
    extensions.digest(items_payload::text, 'sha256'),
    'hex'
  );

  quote_expires_at := quote_created_at + interval '5 minutes';

  -- Pilot ETA: merchant preparation plus distance travel at approximately
  -- 15 km/h, with a ten-minute pickup/handoff allowance and a 15-minute floor.
  estimated_travel_minutes := greatest(
    15,
    ceil(distance_meters::numeric / 250)::integer + 10
  );

  quote_estimated_delivery_at :=
    quote_created_at
    + make_interval(
        mins =>
          shop_row.average_preparation_minutes
          + estimated_travel_minutes
      );

  quote_payload := jsonb_build_object(
    'id', quote_id,
    'cartId', cart_row.id,
    'address',
      jsonb_build_object(
        'id', address_row.id,
        'label', address_row.label,
        'recipientName', address_row.recipient_name,
        'phoneNumber', address_row.phone_number,
        'line1', address_row.line1,
        'line2', address_row.line2,
        'landmark', address_row.landmark,
        'area', address_row.area,
        'city', address_row.city,
        'state', address_row.state,
        'postalCode', address_row.postal_code,
        'countryCode', address_row.country_code,
        'latitude',
          extensions.st_y(
            address_row.location::extensions.geometry
          ),
        'longitude',
          extensions.st_x(
            address_row.location::extensions.geometry
          )
      ),
    'shop',
      jsonb_build_object(
        'id', shop_row.id,
        'name', shop_row.name,
        'slug', shop_row.slug,
        'minimumOrderPaise', shop_row.minimum_order_paise,
        'averagePreparationMinutes',
          shop_row.average_preparation_minutes,
        'distanceMeters', distance_meters,
        'serviceRadiusMeters', shop_row.service_radius_meters
      ),
    'items', items_payload,
    'totals',
      jsonb_build_object(
        'subtotalPaise', subtotal_paise,
        'productDiscountPaise', 0,
        'couponDiscountPaise', 0,
        'deliveryFeePaise', 0,
        'platformFeePaise', 0,
        'taxPaise', 0,
        'totalPaise', subtotal_paise
      ),
    'estimatedPreparationMinutes',
      shop_row.average_preparation_minutes,
    'estimatedTravelMinutes', estimated_travel_minutes,
    'estimatedDeliveryAt', quote_estimated_delivery_at,
    'expiresAt', quote_expires_at,
    'createdAt', quote_created_at
  );

  insert into public.checkout_quotes (
    id,
    customer_id,
    cart_id,
    shop_id,
    address_id,
    cart_snapshot_hash,
    payload,
    subtotal_paise,
    product_discount_paise,
    coupon_discount_paise,
    delivery_fee_paise,
    platform_fee_paise,
    tax_paise,
    total_paise,
    distance_meters,
    estimated_preparation_minutes,
    estimated_travel_minutes,
    estimated_delivery_at,
    expires_at,
    created_at
  )
  values (
    quote_id,
    actor_id,
    cart_row.id,
    cart_row.shop_id,
    address_row.id,
    cart_snapshot_hash,
    quote_payload,
    subtotal_paise,
    0,
    0,
    0,
    0,
    0,
    subtotal_paise,
    distance_meters,
    shop_row.average_preparation_minutes,
    estimated_travel_minutes,
    quote_estimated_delivery_at,
    quote_expires_at,
    quote_created_at
  );

  return quote_payload;
end;
$$;

comment on function public.create_customer_checkout_quote(uuid, uuid) is
  'Creates a five-minute customer checkout snapshot after live cart, price, stock, address, serviceability, and minimum-order validation.';

revoke all
on function public.create_customer_checkout_quote(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.create_customer_checkout_quote(uuid, uuid)
to service_role;
