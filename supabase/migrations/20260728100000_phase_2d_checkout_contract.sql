-- Phase 2D-A: branch-aware checkout contract.
--
-- Extends the existing single-shop checkout quote with one exact fulfilment
-- branch for the complete cart. Quote creation remains read-only; order
-- placement performs the later revalidation and inventory mutation.

alter table public.checkout_quotes
  add column contract_version smallint not null default 1,
  add column merchant_branch_id uuid,
  add column city_id uuid,
  add column service_zone_id uuid,
  add column fulfilment_mode public.fulfilment_mode,
  add column city_configuration_version integer,
  add column cod_eligible boolean,
  add column cod_limit_paise public.money_paise,
  add column branch_snapshot jsonb,
  add column geography_snapshot jsonb,
  add column commercial_snapshot jsonb;

alter table public.checkout_quotes
  add constraint checkout_quotes_branch_shop_fkey
    foreign key (merchant_branch_id, shop_id)
    references public.merchant_branches (id, shop_id)
    on update cascade
    on delete restrict,
  add constraint checkout_quotes_branch_city_fkey
    foreign key (merchant_branch_id, city_id)
    references public.merchant_branches (id, city_id)
    on update cascade
    on delete restrict,
  add constraint checkout_quotes_zone_city_fkey
    foreign key (service_zone_id, city_id)
    references public.service_zones (id, city_id)
    on update cascade
    on delete restrict,
  add constraint checkout_quotes_contract_version_positive
    check (contract_version > 0),
  add constraint checkout_quotes_city_configuration_version_positive
    check (
      city_configuration_version is null
      or city_configuration_version > 0
    ),
  add constraint checkout_quotes_branch_snapshot_object
    check (
      branch_snapshot is null
      or jsonb_typeof(branch_snapshot) = 'object'
    ),
  add constraint checkout_quotes_geography_snapshot_object
    check (
      geography_snapshot is null
      or jsonb_typeof(geography_snapshot) = 'object'
    ),
  add constraint checkout_quotes_commercial_snapshot_object
    check (
      commercial_snapshot is null
      or jsonb_typeof(commercial_snapshot) = 'object'
    ),
  add constraint checkout_quotes_contract_shape
    check (
      (
        contract_version = 1
        and merchant_branch_id is null
        and city_id is null
        and service_zone_id is null
        and fulfilment_mode is null
        and city_configuration_version is null
        and cod_eligible is null
        and cod_limit_paise is null
        and branch_snapshot is null
        and geography_snapshot is null
        and commercial_snapshot is null
      )
      or (
        contract_version = 2
        and merchant_branch_id is not null
        and city_id is not null
        and service_zone_id is not null
        and fulfilment_mode = 'LOCAL_DELIVERY'
        and city_configuration_version is not null
        and cod_eligible is not null
        and cod_limit_paise is not null
        and branch_snapshot is not null
        and geography_snapshot is not null
        and commercial_snapshot is not null
      )
    );

create index checkout_quotes_branch_created_idx
  on public.checkout_quotes (merchant_branch_id, created_at desc)
  where contract_version = 2;

alter table public.orders
  add column order_contract_version smallint not null default 1,
  add column merchant_branch_id uuid,
  add column city_id uuid,
  add column service_zone_id uuid,
  add column fulfilment_mode public.fulfilment_mode,
  add column customer_pincode text,
  add column branch_snapshot jsonb,
  add column geography_snapshot jsonb,
  add column commercial_snapshot jsonb,
  add column city_configuration_version integer;

alter table public.orders
  add constraint orders_branch_shop_fkey
    foreign key (merchant_branch_id, shop_id)
    references public.merchant_branches (id, shop_id)
    on update cascade
    on delete restrict,
  add constraint orders_branch_city_fkey
    foreign key (merchant_branch_id, city_id)
    references public.merchant_branches (id, city_id)
    on update cascade
    on delete restrict,
  add constraint orders_zone_city_fkey
    foreign key (service_zone_id, city_id)
    references public.service_zones (id, city_id)
    on update cascade
    on delete restrict,
  add constraint orders_contract_version_positive
    check (order_contract_version > 0),
  add constraint orders_customer_pincode_format
    check (
      customer_pincode is null
      or customer_pincode ~ '^[1-9][0-9]{5}$'
    ),
  add constraint orders_city_configuration_version_positive
    check (
      city_configuration_version is null
      or city_configuration_version > 0
    ),
  add constraint orders_branch_snapshot_object
    check (
      branch_snapshot is null
      or jsonb_typeof(branch_snapshot) = 'object'
    ),
  add constraint orders_geography_snapshot_object
    check (
      geography_snapshot is null
      or jsonb_typeof(geography_snapshot) = 'object'
    ),
  add constraint orders_commercial_snapshot_object
    check (
      commercial_snapshot is null
      or jsonb_typeof(commercial_snapshot) = 'object'
    ),
  add constraint orders_contract_shape
    check (
      (
        order_contract_version = 1
        and merchant_branch_id is null
        and city_id is null
        and service_zone_id is null
        and fulfilment_mode is null
        and customer_pincode is null
        and branch_snapshot is null
        and geography_snapshot is null
        and commercial_snapshot is null
        and city_configuration_version is null
      )
      or (
        order_contract_version = 2
        and merchant_branch_id is not null
        and city_id is not null
        and fulfilment_mode is not null
        and customer_pincode is not null
        and branch_snapshot is not null
        and geography_snapshot is not null
        and commercial_snapshot is not null
        and city_configuration_version is not null
        and (
          (
            fulfilment_mode = 'LOCAL_DELIVERY'
            and service_zone_id is not null
          )
          or (
            fulfilment_mode = 'POSTAL_DELIVERY'
            and service_zone_id is null
          )
        )
      )
    );

create index orders_branch_status_created_idx
  on public.orders (merchant_branch_id, status, created_at desc)
  where order_contract_version = 2;

alter table public.order_items
  add column branch_inventory_version_snapshot integer,
  add column branch_inventory_reservation_id uuid;

alter table public.order_items
  add constraint order_items_branch_inventory_version_positive
    check (
      branch_inventory_version_snapshot is null
      or branch_inventory_version_snapshot > 0
    ),
  add constraint order_items_branch_reservation_fkey
    foreign key (branch_inventory_reservation_id)
    references public.branch_inventory_reservations (id)
    on update cascade
    on delete restrict;

create unique index order_items_branch_reservation_unique_idx
  on public.order_items (branch_inventory_reservation_id)
  where branch_inventory_reservation_id is not null;

create or replace function private.prevent_order_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_contract_version is distinct from old.order_contract_version
    or new.merchant_branch_id is distinct from old.merchant_branch_id
    or new.city_id is distinct from old.city_id
    or new.service_zone_id is distinct from old.service_zone_id
    or new.fulfilment_mode is distinct from old.fulfilment_mode
    or new.customer_pincode is distinct from old.customer_pincode
    or new.branch_snapshot is distinct from old.branch_snapshot
    or new.geography_snapshot is distinct from old.geography_snapshot
    or new.commercial_snapshot is distinct from old.commercial_snapshot
    or new.city_configuration_version
      is distinct from old.city_configuration_version
  then
    raise exception 'ORDER_COMMERCIAL_SNAPSHOT_IMMUTABLE'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger orders_prevent_snapshot_mutation
before update on public.orders
for each row execute function private.prevent_order_snapshot_mutation();

create or replace function private.prevent_order_item_branch_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.branch_inventory_version_snapshot is not null
    and new.branch_inventory_version_snapshot
      is distinct from old.branch_inventory_version_snapshot
  then
    raise exception 'ORDER_ITEM_BRANCH_SNAPSHOT_IMMUTABLE'
      using errcode = '55000';
  end if;

  if old.branch_inventory_reservation_id is not null
    and new.branch_inventory_reservation_id
      is distinct from old.branch_inventory_reservation_id
  then
    raise exception 'ORDER_ITEM_BRANCH_RESERVATION_IMMUTABLE'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger order_items_prevent_branch_snapshot_mutation
before update on public.order_items
for each row execute function private.prevent_order_item_branch_snapshot_mutation();

create or replace function private.build_checkout_address_snapshot(
  p_address_id uuid
)
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
    'latitude',
      extensions.st_y(a.location::extensions.geometry),
    'longitude',
      extensions.st_x(a.location::extensions.geometry)
  )
  from public.addresses a
  where a.id = p_address_id;
$$;

create or replace function private.build_branch_cart_items_snapshot(
  p_cart_id uuid,
  p_branch_id uuid,
  p_at timestamptz
)
returns table (
  items_payload jsonb,
  item_count integer,
  subtotal_paise bigint,
  has_unavailable_items boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'cartItemId', ci.id,
          'variantId', pv.id,
          'productId', product.id,
          'productName', product.name,
          'sku', pv.sku,
          'colourName', pv.colour_name,
          'sizeLabel', pv.size_label,
          'quantity', ci.quantity,
          'previousUnitPricePaise', ci.unit_price_snapshot_paise,
          'unitPricePaise', pv.selling_price_paise,
          'priceChanged',
            ci.unit_price_snapshot_paise <> pv.selling_price_paise,
          'availableQuantity',
            greatest(
              coalesce(bi.available_quantity, 0)
              + case
                  when mb.is_primary
                    and mb.migration_source = 'LEGACY_SHOP'
                  then coalesce(owned_legacy.quantity, 0)
                  else 0
                end,
              0
            ),
          'branchInventoryVersion', coalesce(bi.version, 1),
          'lineTotalPaise',
            ci.quantity::bigint * pv.selling_price_paise
        )
        order by ci.added_at, ci.id
      ),
      '[]'::jsonb
    ),
    count(*)::integer,
    coalesce(
      sum(ci.quantity::bigint * pv.selling_price_paise),
      0
    )::bigint,
    coalesce(
      bool_or(
        not (
          product.moderation_status = 'APPROVED'
          and product.is_active
          and product.deleted_at is null
          and pv.is_active
          and bi.id is not null
          and greatest(
            bi.available_quantity
            + case
                when mb.is_primary
                  and mb.migration_source = 'LEGACY_SHOP'
                then coalesce(owned_legacy.quantity, 0)
                else 0
              end,
            0
          ) >= ci.quantity
        )
      ),
      false
    )
  from public.cart_items ci
  join public.product_variants pv
    on pv.id = ci.variant_id
   and pv.shop_id = ci.shop_id
  join public.products product
    on product.id = pv.product_id
   and product.shop_id = pv.shop_id
  join public.merchant_branches mb
    on mb.id = p_branch_id
   and mb.shop_id = ci.shop_id
  left join public.branch_inventory bi
    on bi.branch_id = mb.id
   and bi.shop_id = mb.shop_id
   and bi.variant_id = ci.variant_id
  left join lateral (
    select coalesce(sum(ir.quantity), 0)::integer as quantity
    from public.inventory_reservations ir
    where ir.cart_id = ci.cart_id
      and ir.variant_id = ci.variant_id
      and ir.status = 'ACTIVE'
      and ir.expires_at > p_at
  ) owned_legacy on true
  where ci.cart_id = p_cart_id;
$$;

create or replace function private.find_cart_local_fulfilment_branch(
  p_cart_id uuid,
  p_city_id uuid,
  p_service_zone_id uuid,
  p_customer_location extensions.geography,
  p_at timestamptz
)
returns table (
  branch_id uuid,
  shop_id uuid,
  city_id uuid,
  service_zone_id uuid,
  distance_meters integer,
  delivery_radius_meters integer,
  delivery_fee_paise bigint,
  estimated_preparation_minutes integer,
  estimated_travel_minutes integer,
  city_configuration_version integer,
  cod_limit_paise bigint,
  merchant_commission_bps integer,
  cancellation_policy jsonb,
  refund_policy jsonb,
  minimum_available_quantity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    mb.id,
    mb.shop_id,
    mb.city_id,
    bsz.service_zone_id,
    distance.distance_meters,
    radius.delivery_radius_meters,
    (
      cc.base_delivery_fee_paise
      + ceil(
          distance.distance_meters::numeric
          * cc.per_km_delivery_fee_paise::numeric
          / 1000
        )::bigint
    )::bigint,
    mb.average_preparation_minutes::integer,
    greatest(
      15,
      ceil(distance.distance_meters::numeric / 250)::integer + 10
    ),
    cc.version,
    cc.default_cod_limit_paise::bigint,
    cc.merchant_commission_bps,
    cc.cancellation_policy,
    cc.refund_policy,
    coverage.minimum_available_quantity
  from public.carts cart
  join public.merchant_branches mb
    on mb.shop_id = cart.shop_id
  join public.branch_service_zones bsz
    on bsz.branch_id = mb.id
   and bsz.city_id = mb.city_id
   and bsz.service_zone_id = p_service_zone_id
   and bsz.is_active
  join public.shops shop
    on shop.id = mb.shop_id
   and shop.deleted_at is null
   and shop.verification_status = 'VERIFIED'
   and shop.operational_status in ('OPEN', 'BUSY')
   and shop.accepts_online_orders
  join public.merchant_profiles merchant
    on merchant.user_id = mb.merchant_id
   and merchant.kyc_status = 'VERIFIED'
   and merchant.onboarding_status = 'ACTIVE'
  join public.profiles profile
    on profile.id = mb.merchant_id
   and profile.status = 'ACTIVE'
  join public.cities city
    on city.id = mb.city_id
   and city.id = p_city_id
   and city.status = 'ACTIVE'
  join public.city_configurations cc
    on cc.city_id = city.id
   and cc.local_delivery_enabled
  join public.service_zones zone
    on zone.id = bsz.service_zone_id
   and zone.city_id = city.id
   and zone.status = 'ACTIVE'
  cross join lateral (
    select round(
      extensions.st_distance(mb.location, p_customer_location)
    )::integer as distance_meters
  ) distance
  cross join lateral (
    select least(
      cc.maximum_delivery_radius_meters,
      coalesce(
        zone.default_delivery_radius_meters,
        cc.default_delivery_radius_meters
      )
    )::integer as delivery_radius_meters
  ) radius
  cross join lateral (
    select min(
      greatest(
        coalesce(bi.available_quantity, 0)
        + case
            when mb.is_primary
              and mb.migration_source = 'LEGACY_SHOP'
            then coalesce(owned_legacy.quantity, 0)
            else 0
          end,
        0
      )
    )::integer as minimum_available_quantity
    from public.cart_items ci
    left join public.branch_inventory bi
      on bi.branch_id = mb.id
     and bi.shop_id = mb.shop_id
     and bi.variant_id = ci.variant_id
    left join lateral (
      select coalesce(sum(ir.quantity), 0)::integer as quantity
      from public.inventory_reservations ir
      where ir.cart_id = ci.cart_id
        and ir.variant_id = ci.variant_id
        and ir.status = 'ACTIVE'
        and ir.expires_at > p_at
    ) owned_legacy on true
    where ci.cart_id = cart.id
  ) coverage
  where cart.id = p_cart_id
    and cart.status = 'ACTIVE'
    and mb.status = 'ACTIVE'
    and mb.verification_status = 'VERIFIED'
    and mb.geography_status = 'VERIFIED'
    and mb.local_delivery_enabled
    and distance.distance_meters <= radius.delivery_radius_meters
    and not exists (
      select 1
      from public.cart_items ci
      join public.product_variants pv
        on pv.id = ci.variant_id
       and pv.shop_id = ci.shop_id
      join public.products product
        on product.id = pv.product_id
       and product.shop_id = pv.shop_id
      left join public.branch_inventory bi
        on bi.branch_id = mb.id
       and bi.shop_id = mb.shop_id
       and bi.variant_id = ci.variant_id
      left join lateral (
        select coalesce(sum(ir.quantity), 0)::integer as quantity
        from public.inventory_reservations ir
        where ir.cart_id = ci.cart_id
          and ir.variant_id = ci.variant_id
          and ir.status = 'ACTIVE'
          and ir.expires_at > p_at
      ) owned_legacy on true
      where ci.cart_id = cart.id
        and (
          product.moderation_status <> 'APPROVED'
          or not product.is_active
          or product.deleted_at is not null
          or not pv.is_active
          or bi.id is null
          or greatest(
            coalesce(bi.available_quantity, 0)
            + case
                when mb.is_primary
                  and mb.migration_source = 'LEGACY_SHOP'
                then coalesce(owned_legacy.quantity, 0)
                else 0
              end,
            0
          ) < ci.quantity
        )
    )
  order by
    bsz.is_primary desc,
    distance.distance_meters,
    mb.average_preparation_minutes,
    coverage.minimum_available_quantity desc,
    mb.id
  limit 1;
$$;

create or replace function private.find_cart_postal_fulfilment_branch(
  p_cart_id uuid,
  p_pincode text,
  p_at timestamptz
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select mb.id
  from public.carts cart
  join public.merchant_branches mb
    on mb.shop_id = cart.shop_id
  join public.shops shop
    on shop.id = mb.shop_id
   and shop.deleted_at is null
   and shop.verification_status = 'VERIFIED'
   and shop.operational_status in ('OPEN', 'BUSY')
   and shop.accepts_online_orders
  join public.merchant_profiles merchant
    on merchant.user_id = mb.merchant_id
   and merchant.kyc_status = 'VERIFIED'
   and merchant.onboarding_status = 'ACTIVE'
  join public.profiles profile
    on profile.id = mb.merchant_id
   and profile.status = 'ACTIVE'
  join public.cities city
    on city.id = mb.city_id
   and city.status = 'ACTIVE'
  join public.city_configurations cc
    on cc.city_id = city.id
   and cc.postal_delivery_enabled
  where cart.id = p_cart_id
    and cart.status = 'ACTIVE'
    and mb.status = 'ACTIVE'
    and mb.verification_status = 'VERIFIED'
    and mb.geography_status = 'VERIFIED'
    and mb.postal_delivery_enabled
    and (
      mb.all_india_postal_enabled
      or exists (
        select 1
        from public.branch_postal_serviceability bps
        where bps.branch_id = mb.id
          and bps.pincode = p_pincode
          and bps.is_active
      )
    )
    and not exists (
      select 1
      from public.cart_items ci
      join public.product_variants pv
        on pv.id = ci.variant_id
       and pv.shop_id = ci.shop_id
      join public.products product
        on product.id = pv.product_id
       and product.shop_id = pv.shop_id
      left join public.branch_inventory bi
        on bi.branch_id = mb.id
       and bi.shop_id = mb.shop_id
       and bi.variant_id = ci.variant_id
      where ci.cart_id = cart.id
        and (
          product.moderation_status <> 'APPROVED'
          or not product.is_active
          or product.deleted_at is not null
          or not pv.is_active
          or bi.id is null
          or bi.available_quantity < ci.quantity
        )
    )
  order by
    exists (
      select 1
      from public.branch_postal_serviceability bps
      where bps.branch_id = mb.id
        and bps.pincode = p_pincode
        and bps.is_active
    ) desc,
    mb.average_preparation_minutes,
    mb.id
  limit 1;
$$;

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
  v_actor_id uuid := p_actor;
  v_now timestamptz := statement_timestamp();
  v_cart public.carts;
  v_address public.addresses;
  v_shop public.shops;
  v_branch public.merchant_branches;
  v_city public.cities;
  v_zone public.service_zones;
  v_area jsonb;
  v_selected record;
  v_items jsonb;
  v_item_count integer;
  v_subtotal bigint;
  v_unavailable boolean;
  v_address_snapshot jsonb;
  v_branch_snapshot jsonb;
  v_geography_snapshot jsonb;
  v_commercial_snapshot jsonb;
  v_shop_snapshot jsonb;
  v_cart_hash text;
  v_quote_id uuid := gen_random_uuid();
  v_expires_at timestamptz := statement_timestamp() + interval '5 minutes';
  v_estimated_delivery_at timestamptz;
  v_total bigint;
  v_cod_eligible boolean;
  v_payload jsonb;
  v_postal_branch_id uuid;
begin
  if v_actor_id is null or p_address_id is null then
    raise exception 'actor and address are required'
      using errcode = '22023';
  end if;

  perform 1
  from public.customer_profiles cp
  where cp.user_id = v_actor_id
  for update;

  if not found then
    raise exception 'customer profile not found'
      using errcode = '42501';
  end if;

  select *
  into v_cart
  from public.carts c
  where c.customer_id = v_actor_id
    and c.status = 'ACTIVE'
  order by c.created_at desc, c.id
  limit 1
  for update;

  if not found then
    raise exception 'active customer cart not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_address
  from public.addresses a
  where a.id = p_address_id
    and a.user_id = v_actor_id;

  if not found then
    raise exception 'customer address not found'
      using errcode = 'P0006';
  end if;

  select *
  into strict v_shop
  from public.shops s
  where s.id = v_cart.shop_id;

  perform 1
  from public.cart_items ci
  where ci.cart_id = v_cart.id
  order by ci.variant_id, ci.id
  for share;

  if not found then
    raise exception 'active customer cart is empty'
      using errcode = 'P0002';
  end if;

  v_area := private.resolve_customer_service_area_internal(
    extensions.st_y(v_address.location::extensions.geometry),
    extensions.st_x(v_address.location::extensions.geometry),
    v_address.postal_code
  );

  if not coalesce((v_area ->> 'resolved')::boolean, false)
    or not coalesce(
      (v_area ->> 'localDeliveryEnabled')::boolean,
      false
    )
  then
    v_postal_branch_id := private.find_cart_postal_fulfilment_branch(
      v_cart.id,
      v_address.postal_code,
      v_now
    );

    if v_postal_branch_id is not null then
      raise exception 'POSTAL_PRICING_REQUIRED'
        using errcode = 'P0022';
    end if;

    raise exception '%', coalesce(
      v_area ->> 'reasonCode',
      'address is not serviceable'
    )
      using errcode = 'P0008';
  end if;

  select *
  into v_selected
  from private.find_cart_local_fulfilment_branch(
    v_cart.id,
    (v_area ->> 'cityId')::uuid,
    (v_area ->> 'serviceZoneId')::uuid,
    v_address.location,
    v_now
  );

  if not found then
    v_postal_branch_id := private.find_cart_postal_fulfilment_branch(
      v_cart.id,
      v_address.postal_code,
      v_now
    );

    if v_postal_branch_id is not null then
      raise exception 'POSTAL_PRICING_REQUIRED'
        using errcode = 'P0022';
    end if;

    raise exception 'NO_SINGLE_BRANCH_CAN_FULFIL_CART'
      using errcode = 'P0021';
  end if;

  select *
  into strict v_branch
  from public.merchant_branches mb
  where mb.id = v_selected.branch_id;

  select *
  into strict v_city
  from public.cities c
  where c.id = v_selected.city_id;

  select *
  into strict v_zone
  from public.service_zones sz
  where sz.id = v_selected.service_zone_id
    and sz.city_id = v_selected.city_id;

  perform 1
  from public.branch_inventory bi
  join public.cart_items ci
    on ci.variant_id = bi.variant_id
   and ci.shop_id = bi.shop_id
  where bi.branch_id = v_branch.id
    and ci.cart_id = v_cart.id
  order by bi.variant_id, bi.id
  for share of bi;

  select *
  into
    v_items,
    v_item_count,
    v_subtotal,
    v_unavailable
  from private.build_branch_cart_items_snapshot(
    v_cart.id,
    v_branch.id,
    v_now
  );

  if v_item_count = 0 then
    raise exception 'active customer cart is empty'
      using errcode = 'P0002';
  end if;

  if v_unavailable then
    raise exception 'NO_SINGLE_BRANCH_CAN_FULFIL_CART'
      using errcode = 'P0021';
  end if;

  if v_subtotal < v_shop.minimum_order_paise then
    raise exception 'minimum order amount is not met'
      using errcode = 'P0009';
  end if;

  v_total := v_subtotal + v_selected.delivery_fee_paise;
  v_cod_eligible := v_total <= v_selected.cod_limit_paise;
  v_estimated_delivery_at :=
    v_now
    + make_interval(
        mins =>
          v_selected.estimated_preparation_minutes
          + v_selected.estimated_travel_minutes
      );

  v_address_snapshot :=
    private.build_checkout_address_snapshot(v_address.id);

  v_branch_snapshot := jsonb_build_object(
    'id', v_branch.id,
    'code', v_branch.branch_code,
    'name', v_branch.name,
    'type', v_branch.branch_type,
    'addressId', v_branch.address_id,
    'returnAddressId', v_branch.return_address_id,
    'pincode', v_branch.pincode,
    'latitude',
      extensions.st_y(v_branch.location::extensions.geometry),
    'longitude',
      extensions.st_x(v_branch.location::extensions.geometry)
  );

  v_geography_snapshot := jsonb_build_object(
    'cityId', v_city.id,
    'cityCode', v_city.code,
    'cityName', v_city.name,
    'serviceZoneId', v_zone.id,
    'serviceZoneCode', v_zone.code,
    'serviceZoneName', v_zone.name,
    'customerPincode', v_address.postal_code,
    'fulfilmentMode', 'LOCAL_DELIVERY',
    'distanceMeters', v_selected.distance_meters,
    'deliveryRadiusMeters', v_selected.delivery_radius_meters
  );

  v_commercial_snapshot := jsonb_build_object(
    'deliveryFeePaise', v_selected.delivery_fee_paise,
    'codEligible', v_cod_eligible,
    'codLimitPaise', v_selected.cod_limit_paise,
    'merchantCommissionBps', v_selected.merchant_commission_bps,
    'cityConfigurationVersion',
      v_selected.city_configuration_version,
    'cancellationPolicy', v_selected.cancellation_policy,
    'refundPolicy', v_selected.refund_policy
  );

  v_shop_snapshot := jsonb_build_object(
    'id', v_shop.id,
    'name', v_shop.name,
    'slug', v_shop.slug,
    'minimumOrderPaise', v_shop.minimum_order_paise
  );

  v_cart_hash := encode(
    extensions.digest(v_items::text, 'sha256'),
    'hex'
  );

  v_payload := jsonb_build_object(
    'id', v_quote_id,
    'contractVersion', 2,
    'cartId', v_cart.id,
    'address', v_address_snapshot,
    'shop', v_shop_snapshot,
    'branch', v_branch_snapshot,
    'geography', v_geography_snapshot,
    'items', v_items,
    'totals',
      jsonb_build_object(
        'subtotalPaise', v_subtotal,
        'productDiscountPaise', 0,
        'couponDiscountPaise', 0,
        'deliveryFeePaise', v_selected.delivery_fee_paise,
        'platformFeePaise', 0,
        'taxPaise', 0,
        'totalPaise', v_total
      ),
    'fulfilmentMode', 'LOCAL_DELIVERY',
    'codEligible', v_cod_eligible,
    'codLimitPaise', v_selected.cod_limit_paise,
    'estimatedPreparationMinutes',
      v_selected.estimated_preparation_minutes,
    'estimatedTravelMinutes',
      v_selected.estimated_travel_minutes,
    'estimatedDeliveryAt', v_estimated_delivery_at,
    'cityConfigurationVersion',
      v_selected.city_configuration_version,
    'expiresAt', v_expires_at,
    'createdAt', v_now
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
    created_at,
    contract_version,
    merchant_branch_id,
    city_id,
    service_zone_id,
    fulfilment_mode,
    city_configuration_version,
    cod_eligible,
    cod_limit_paise,
    branch_snapshot,
    geography_snapshot,
    commercial_snapshot
  )
  values (
    v_quote_id,
    v_actor_id,
    v_cart.id,
    v_cart.shop_id,
    v_address.id,
    v_cart_hash,
    v_payload,
    v_subtotal,
    0,
    0,
    v_selected.delivery_fee_paise,
    0,
    0,
    v_total,
    v_selected.distance_meters,
    v_selected.estimated_preparation_minutes,
    v_selected.estimated_travel_minutes,
    v_estimated_delivery_at,
    v_expires_at,
    v_now,
    2,
    v_branch.id,
    v_city.id,
    v_zone.id,
    'LOCAL_DELIVERY',
    v_selected.city_configuration_version,
    v_cod_eligible,
    v_selected.cod_limit_paise,
    v_branch_snapshot,
    v_geography_snapshot,
    v_commercial_snapshot
  );

  return v_payload;
end;
$$;

create or replace function private.revalidate_branch_checkout_quote(
  p_actor uuid,
  p_cart_id uuid,
  p_quote_id uuid,
  p_address_id uuid,
  p_payment_method text
)
returns public.checkout_quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_quote public.checkout_quotes;
  v_cart public.carts;
  v_address public.addresses;
  v_branch public.merchant_branches;
  v_city public.cities;
  v_zone public.service_zones;
  v_config public.city_configurations;
  v_items jsonb;
  v_item_count integer;
  v_subtotal bigint;
  v_unavailable boolean;
  v_address_snapshot jsonb;
  v_branch_snapshot jsonb;
  v_geography_snapshot jsonb;
  v_commercial_snapshot jsonb;
  v_distance integer;
  v_radius integer;
  v_delivery_fee bigint;
  v_travel integer;
  v_total bigint;
begin
  select *
  into v_quote
  from public.checkout_quotes cq
  where cq.id = p_quote_id
    and cq.customer_id = p_actor
    and cq.cart_id = p_cart_id
    and cq.address_id = p_address_id
  for update;

  if not found then
    raise exception 'checkout quote not found'
      using errcode = 'P0011';
  end if;

  if v_quote.contract_version <> 2 then
    raise exception 'CHECKOUT_QUOTE_VERSION_UNSUPPORTED'
      using errcode = 'P0020';
  end if;

  if v_quote.expires_at <= v_now then
    raise exception 'checkout quote has expired'
      using errcode = 'P0012';
  end if;

  if v_quote.fulfilment_mode <> 'LOCAL_DELIVERY' then
    raise exception 'POSTAL_PRICING_REQUIRED'
      using errcode = 'P0022';
  end if;

  if p_payment_method not in ('COD', 'ONLINE') then
    raise exception 'CHECKOUT_PAYMENT_METHOD_INVALID'
      using errcode = '22023';
  end if;

  select *
  into v_cart
  from public.carts c
  where c.id = p_cart_id
    and c.customer_id = p_actor
    and c.shop_id = v_quote.shop_id
    and c.status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'active customer cart not found'
      using errcode = 'P0002';
  end if;

  select *
  into v_address
  from public.addresses a
  where a.id = p_address_id
    and a.user_id = p_actor;

  if not found then
    raise exception 'customer address not found'
      using errcode = 'P0011';
  end if;

  perform 1
  from public.cart_items ci
  where ci.cart_id = v_cart.id
  order by ci.variant_id, ci.id
  for update;

  if not found then
    raise exception 'active customer cart not found'
      using errcode = 'P0002';
  end if;

  select *
  into strict v_branch
  from public.merchant_branches mb
  where mb.id = v_quote.merchant_branch_id
  for update;

  select *
  into strict v_city
  from public.cities c
  where c.id = v_quote.city_id
  for share;

  select *
  into strict v_zone
  from public.service_zones sz
  where sz.id = v_quote.service_zone_id
    and sz.city_id = v_quote.city_id
  for share;

  select *
  into strict v_config
  from public.city_configurations cc
  where cc.city_id = v_quote.city_id
  for share;

  if v_branch.status <> 'ACTIVE'
    or v_branch.verification_status <> 'VERIFIED'
    or v_branch.geography_status <> 'VERIFIED'
    or not v_branch.local_delivery_enabled
  then
    raise exception 'BRANCH_NO_LONGER_ACTIVE'
      using errcode = 'P0023';
  end if;

  if v_city.status <> 'ACTIVE'
    or v_zone.status <> 'ACTIVE'
    or not v_config.local_delivery_enabled
  then
    raise exception 'CITY_OR_ZONE_PAUSED'
      using errcode = 'P0023';
  end if;

  if not exists (
    select 1
    from public.branch_service_zones bsz
    where bsz.branch_id = v_branch.id
      and bsz.city_id = v_city.id
      and bsz.service_zone_id = v_zone.id
      and bsz.is_active
  ) then
    raise exception 'CHECKOUT_QUOTE_STALE'
      using errcode = 'P0013';
  end if;

  if not exists (
    select 1
    from public.service_zone_pincodes szp
    where szp.city_id = v_city.id
      and szp.service_zone_id = v_zone.id
      and szp.pincode = v_address.postal_code
      and szp.is_active
      and (
        v_zone.boundary is null
        or extensions.st_covers(
          v_zone.boundary,
          v_address.location::extensions.geometry
        )
      )
  ) then
    raise exception 'CHECKOUT_QUOTE_STALE'
      using errcode = 'P0013';
  end if;

  perform 1
  from public.branch_inventory bi
  join public.cart_items ci
    on ci.variant_id = bi.variant_id
   and ci.shop_id = bi.shop_id
  where bi.branch_id = v_branch.id
    and ci.cart_id = v_cart.id
  order by bi.variant_id, bi.id
  for update of bi;

  select *
  into
    v_items,
    v_item_count,
    v_subtotal,
    v_unavailable
  from private.build_branch_cart_items_snapshot(
    v_cart.id,
    v_branch.id,
    v_now
  );

  if v_item_count = 0 or v_unavailable then
    raise exception 'INSUFFICIENT_BRANCH_STOCK'
      using errcode = 'P0001';
  end if;

  v_address_snapshot :=
    private.build_checkout_address_snapshot(v_address.id);

  v_distance := round(
    extensions.st_distance(v_branch.location, v_address.location)
  )::integer;

  v_radius := least(
    v_config.maximum_delivery_radius_meters,
    coalesce(
      v_zone.default_delivery_radius_meters,
      v_config.default_delivery_radius_meters
    )
  )::integer;

  if v_distance > v_radius then
    raise exception 'CHECKOUT_QUOTE_STALE'
      using errcode = 'P0013';
  end if;

  v_delivery_fee :=
    v_config.base_delivery_fee_paise
    + ceil(
        v_distance::numeric
        * v_config.per_km_delivery_fee_paise::numeric
        / 1000
      )::bigint;

  v_travel := greatest(
    15,
    ceil(v_distance::numeric / 250)::integer + 10
  );

  v_total := v_subtotal + v_delivery_fee;

  v_branch_snapshot := jsonb_build_object(
    'id', v_branch.id,
    'code', v_branch.branch_code,
    'name', v_branch.name,
    'type', v_branch.branch_type,
    'addressId', v_branch.address_id,
    'returnAddressId', v_branch.return_address_id,
    'pincode', v_branch.pincode,
    'latitude',
      extensions.st_y(v_branch.location::extensions.geometry),
    'longitude',
      extensions.st_x(v_branch.location::extensions.geometry)
  );

  v_geography_snapshot := jsonb_build_object(
    'cityId', v_city.id,
    'cityCode', v_city.code,
    'cityName', v_city.name,
    'serviceZoneId', v_zone.id,
    'serviceZoneCode', v_zone.code,
    'serviceZoneName', v_zone.name,
    'customerPincode', v_address.postal_code,
    'fulfilmentMode', 'LOCAL_DELIVERY',
    'distanceMeters', v_distance,
    'deliveryRadiusMeters', v_radius
  );

  v_commercial_snapshot := jsonb_build_object(
    'deliveryFeePaise', v_delivery_fee,
    'codEligible', v_total <= v_config.default_cod_limit_paise,
    'codLimitPaise', v_config.default_cod_limit_paise,
    'merchantCommissionBps', v_config.merchant_commission_bps,
    'cityConfigurationVersion', v_config.version,
    'cancellationPolicy', v_config.cancellation_policy,
    'refundPolicy', v_config.refund_policy
  );

  if v_quote.cart_snapshot_hash
      <> encode(extensions.digest(v_items::text, 'sha256'), 'hex')
    or v_quote.payload -> 'items' <> v_items
    or v_quote.payload -> 'address' <> v_address_snapshot
    or v_quote.branch_snapshot <> v_branch_snapshot
    or v_quote.geography_snapshot <> v_geography_snapshot
    or v_quote.commercial_snapshot <> v_commercial_snapshot
    or v_quote.subtotal_paise <> v_subtotal
    or v_quote.product_discount_paise <> 0
    or v_quote.coupon_discount_paise <> 0
    or v_quote.delivery_fee_paise <> v_delivery_fee
    or v_quote.platform_fee_paise <> 0
    or v_quote.tax_paise <> 0
    or v_quote.total_paise <> v_total
    or v_quote.distance_meters <> v_distance
    or v_quote.estimated_preparation_minutes
      <> v_branch.average_preparation_minutes
    or v_quote.estimated_travel_minutes <> v_travel
    or v_quote.city_configuration_version <> v_config.version
    or v_quote.cod_limit_paise <> v_config.default_cod_limit_paise
    or v_quote.cod_eligible
      <> (v_total <= v_config.default_cod_limit_paise)
  then
    raise exception 'checkout quote no longer matches current state'
      using errcode = 'P0013';
  end if;

  if p_payment_method = 'COD'
    and not v_quote.cod_eligible
  then
    raise exception 'COD_NOT_ELIGIBLE'
      using errcode = 'P0024';
  end if;

  return v_quote;
end;
$$;

comment on function public.create_customer_checkout_quote(uuid, uuid) is
  'Creates a five-minute branch-aware checkout quote for one complete single-shop cart without reserving inventory.';

revoke all
on function private.prevent_order_snapshot_mutation()
from public, anon, authenticated;

revoke all
on function private.prevent_order_item_branch_snapshot_mutation()
from public, anon, authenticated;

revoke all
on function private.build_checkout_address_snapshot(uuid)
from public, anon, authenticated;

revoke all
on function private.build_branch_cart_items_snapshot(
  uuid,
  uuid,
  timestamptz
)
from public, anon, authenticated;

revoke all
on function private.find_cart_local_fulfilment_branch(
  uuid,
  uuid,
  uuid,
  extensions.geography,
  timestamptz
)
from public, anon, authenticated;

revoke all
on function private.find_cart_postal_fulfilment_branch(
  uuid,
  text,
  timestamptz
)
from public, anon, authenticated;

revoke all
on function private.revalidate_branch_checkout_quote(
  uuid,
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated;
