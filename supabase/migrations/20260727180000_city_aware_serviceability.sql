-- Phase 2C: city-aware serviceability and branch-aware catalogue quotes.
--
-- Quotes are informational, expire quickly, and never reserve stock. Checkout
-- remains responsible for revalidation and atomic branch inventory reservation.

create type public.fulfilment_mode as enum (
  'LOCAL_DELIVERY',
  'POSTAL_DELIVERY'
);

create table private.variant_serviceability_quotes (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null,
  shop_id uuid not null,
  branch_id uuid not null,
  city_id uuid not null,
  service_zone_id uuid,
  fulfilment_mode public.fulfilment_mode not null,
  requested_quantity public.positive_quantity not null,
  pincode text not null,
  customer_location extensions.geography(Point, 4326) not null,
  available_quantity public.non_negative_quantity not null,
  distance_meters public.non_negative_quantity,
  delivery_fee_paise public.money_paise,
  estimated_preparation_minutes public.non_negative_quantity not null,
  estimated_delivery_minutes public.non_negative_quantity,
  estimated_dispatch_hours public.non_negative_quantity,
  cod_eligible boolean not null,
  cod_limit_paise public.money_paise not null,
  payment_mode text not null,
  branch_inventory_version public.positive_quantity not null,
  city_configuration_version public.positive_quantity not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint variant_serviceability_quotes_variant_id_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint variant_serviceability_quotes_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint variant_serviceability_quotes_branch_id_fkey
    foreign key (branch_id, shop_id)
    references public.merchant_branches (id, shop_id)
    on update cascade
    on delete restrict,

  constraint variant_serviceability_quotes_branch_city_fkey
    foreign key (branch_id, city_id)
    references public.merchant_branches (id, city_id)
    on update cascade
    on delete restrict,

  constraint variant_serviceability_quotes_zone_city_fkey
    foreign key (service_zone_id, city_id)
    references public.service_zones (id, city_id)
    on update cascade
    on delete restrict,

  constraint variant_serviceability_quotes_pincode_format
    check (pincode ~ '^[1-9][0-9]{5}$'),

  constraint variant_serviceability_quotes_quantity_available
    check (available_quantity >= requested_quantity),

  constraint variant_serviceability_quotes_expiry
    check (expires_at > created_at),

  constraint variant_serviceability_quotes_payment_mode
    check (payment_mode in ('COD_OR_PREPAID', 'PREPAID_ONLY')),

  constraint variant_serviceability_quotes_mode_shape
    check (
      (
        fulfilment_mode = 'LOCAL_DELIVERY'
        and service_zone_id is not null
        and distance_meters is not null
        and delivery_fee_paise is not null
        and estimated_delivery_minutes is not null
        and estimated_dispatch_hours is null
        and payment_mode = 'COD_OR_PREPAID'
      )
      or (
        fulfilment_mode = 'POSTAL_DELIVERY'
        and service_zone_id is null
        and distance_meters is null
        and delivery_fee_paise is null
        and estimated_delivery_minutes is null
        and estimated_dispatch_hours is not null
        and not cod_eligible
        and payment_mode = 'PREPAID_ONLY'
      )
    )
);

comment on table private.variant_serviceability_quotes is
  'Short-lived branch and commercial configuration snapshots for catalogue availability. Quotes do not reserve inventory.';

create index variant_serviceability_quotes_expiry_idx
  on private.variant_serviceability_quotes (expires_at, id);

create index variant_serviceability_quotes_branch_variant_idx
  on private.variant_serviceability_quotes (
    branch_id,
    variant_id,
    created_at desc
  );

revoke all privileges
on table private.variant_serviceability_quotes
from public, anon, authenticated;

create or replace function private.bump_city_configuration_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

revoke all
on function private.bump_city_configuration_version()
from public, anon, authenticated;

create trigger city_configurations_bump_version
before update on public.city_configurations
for each row execute function private.bump_city_configuration_version();

create or replace function private.resolve_customer_service_area_internal(
  p_latitude double precision,
  p_longitude double precision,
  p_pincode text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_point extensions.geometry(Point, 4326);
  v_city_id uuid;
  v_city_status public.market_lifecycle_status;
  v_service_zone_id uuid;
  v_zone_status public.market_lifecycle_status;
  v_configuration public.city_configurations;
  v_has_mapping boolean;
begin
  if p_latitude is null
    or not (p_latitude between -90 and 90)
    or p_longitude is null
    or not (p_longitude between -180 and 180)
    or p_pincode is null
    or p_pincode !~ '^[1-9][0-9]{5}$'
  then
    return jsonb_build_object(
      'resolved', false,
      'cityId', null,
      'serviceZoneId', null,
      'reasonCode', 'INVALID_LOCATION'
    );
  end if;

  v_point := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
  );

  select
    c.id,
    c.status,
    sz.id,
    sz.status
  into
    v_city_id,
    v_city_status,
    v_service_zone_id,
    v_zone_status
  from public.service_zone_pincodes szp
  join public.cities c
    on c.id = szp.city_id
  join public.service_zones sz
    on sz.id = szp.service_zone_id
   and sz.city_id = c.id
  join public.city_configurations cc
    on cc.city_id = c.id
  where szp.pincode = p_pincode
    and szp.is_active
    and c.status = 'ACTIVE'
    and sz.status = 'ACTIVE'
    and (
      sz.boundary is null
      or extensions.st_covers(sz.boundary, v_point)
    )
  order by
    szp.is_primary desc,
    szp.priority,
    c.id,
    sz.id
  limit 1;

  if found then
    select *
    into strict v_configuration
    from public.city_configurations cc
    where cc.city_id = v_city_id;

    return jsonb_build_object(
      'resolved', true,
      'cityId', v_city_id,
      'serviceZoneId', v_service_zone_id,
      'reasonCode', null,
      'localDeliveryEnabled', v_configuration.local_delivery_enabled,
      'postalDeliveryEnabled', v_configuration.postal_delivery_enabled,
      'defaultDeliveryRadiusMeters',
        v_configuration.default_delivery_radius_meters,
      'maximumDeliveryRadiusMeters',
        v_configuration.maximum_delivery_radius_meters,
      'baseDeliveryFeePaise',
        v_configuration.base_delivery_fee_paise,
      'perKmDeliveryFeePaise',
        v_configuration.per_km_delivery_fee_paise,
      'codLimitPaise',
        v_configuration.default_cod_limit_paise,
      'cityConfigurationVersion',
        v_configuration.version
    );
  end if;

  select exists (
    select 1
    from public.service_zone_pincodes szp
    where szp.pincode = p_pincode
  )
  into v_has_mapping;

  select
    c.id,
    c.status,
    sz.id,
    sz.status
  into
    v_city_id,
    v_city_status,
    v_service_zone_id,
    v_zone_status
  from public.service_zone_pincodes szp
  join public.cities c
    on c.id = szp.city_id
  join public.service_zones sz
    on sz.id = szp.service_zone_id
   and sz.city_id = c.id
  where szp.pincode = p_pincode
  order by
    szp.is_active desc,
    szp.is_primary desc,
    szp.priority,
    c.id,
    sz.id
  limit 1;

  if found then
    if v_city_status = 'PAUSED' then
      return jsonb_build_object(
        'resolved', false,
        'cityId', v_city_id,
        'serviceZoneId', v_service_zone_id,
        'reasonCode', 'CITY_PAUSED'
      );
    end if;

    if v_city_status <> 'ACTIVE' then
      return jsonb_build_object(
        'resolved', false,
        'cityId', v_city_id,
        'serviceZoneId', v_service_zone_id,
        'reasonCode', 'CITY_NOT_SUPPORTED'
      );
    end if;

    if v_zone_status = 'PAUSED' then
      return jsonb_build_object(
        'resolved', false,
        'cityId', v_city_id,
        'serviceZoneId', v_service_zone_id,
        'reasonCode', 'ZONE_PAUSED'
      );
    end if;

    if v_zone_status <> 'ACTIVE' then
      return jsonb_build_object(
        'resolved', false,
        'cityId', v_city_id,
        'serviceZoneId', v_service_zone_id,
        'reasonCode', 'ZONE_NOT_FOUND'
      );
    end if;

    if not exists (
      select 1
      from public.service_zone_pincodes szp
      where szp.pincode = p_pincode
        and szp.is_active
    ) then
      return jsonb_build_object(
        'resolved', false,
        'cityId', v_city_id,
        'serviceZoneId', v_service_zone_id,
        'reasonCode', 'PINCODE_NOT_SUPPORTED'
      );
    end if;

    return jsonb_build_object(
      'resolved', false,
      'cityId', v_city_id,
      'serviceZoneId', v_service_zone_id,
      'reasonCode', 'LOCATION_OUTSIDE_ZONE'
    );
  end if;

  if exists (
    select 1
    from public.cities c
    join public.service_zones sz
      on sz.city_id = c.id
    where c.status = 'ACTIVE'
      and sz.status = 'ACTIVE'
      and sz.boundary is not null
      and extensions.st_covers(sz.boundary, v_point)
  ) then
    return jsonb_build_object(
      'resolved', false,
      'cityId', null,
      'serviceZoneId', null,
      'reasonCode', 'PINCODE_NOT_SUPPORTED'
    );
  end if;

  return jsonb_build_object(
    'resolved', false,
    'cityId', null,
    'serviceZoneId', null,
    'reasonCode',
      case
        when v_has_mapping then 'PINCODE_NOT_SUPPORTED'
        else 'CITY_NOT_SUPPORTED'
      end
  );
end;
$$;

create or replace function private.find_local_fulfilment_branch(
  p_variant_id uuid,
  p_quantity integer,
  p_city_id uuid,
  p_service_zone_id uuid,
  p_customer_location extensions.geography
)
returns table (
  branch_id uuid,
  shop_id uuid,
  city_id uuid,
  service_zone_id uuid,
  available_quantity integer,
  branch_inventory_version integer,
  distance_meters integer,
  delivery_radius_meters integer,
  delivery_fee_paise bigint,
  estimated_preparation_minutes integer,
  estimated_delivery_minutes integer,
  city_configuration_version integer,
  cod_limit_paise bigint,
  unit_price_paise bigint
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
    bi.available_quantity,
    bi.version::integer,
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
    (
      mb.average_preparation_minutes
      + greatest(
          15,
          ceil(distance.distance_meters::numeric / 250)::integer + 10
        )
    )::integer,
    cc.version,
    cc.default_cod_limit_paise::bigint,
    pv.selling_price_paise::bigint
  from public.merchant_branches mb
  join public.branch_service_zones bsz
    on bsz.branch_id = mb.id
   and bsz.city_id = mb.city_id
   and bsz.service_zone_id = p_service_zone_id
   and bsz.is_active
  join public.branch_inventory bi
    on bi.branch_id = mb.id
   and bi.shop_id = mb.shop_id
   and bi.variant_id = p_variant_id
  join public.product_variants pv
    on pv.id = bi.variant_id
   and pv.shop_id = mb.shop_id
   and pv.is_active
  join public.products product
    on product.id = pv.product_id
   and product.shop_id = pv.shop_id
   and product.moderation_status = 'APPROVED'
   and product.is_active
   and product.deleted_at is null
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
  where mb.status = 'ACTIVE'
    and mb.verification_status = 'VERIFIED'
    and mb.geography_status = 'VERIFIED'
    and mb.local_delivery_enabled
    and bi.available_quantity >= p_quantity
    and distance.distance_meters <= radius.delivery_radius_meters
  order by
    bsz.is_primary desc,
    distance.distance_meters,
    bi.available_quantity desc,
    mb.average_preparation_minutes,
    mb.id
  limit 1;
$$;

create or replace function private.find_postal_fulfilment_branch(
  p_variant_id uuid,
  p_quantity integer,
  p_pincode text
)
returns table (
  branch_id uuid,
  shop_id uuid,
  city_id uuid,
  available_quantity integer,
  branch_inventory_version integer,
  estimated_preparation_minutes integer,
  estimated_dispatch_hours integer,
  city_configuration_version integer,
  unit_price_paise bigint,
  explicit_pincode_match boolean
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
    bi.available_quantity,
    bi.version::integer,
    mb.average_preparation_minutes::integer,
    mb.postal_dispatch_sla_hours,
    cc.version,
    pv.selling_price_paise::bigint,
    exists (
      select 1
      from public.branch_postal_serviceability bps
      where bps.branch_id = mb.id
        and bps.pincode = p_pincode
        and bps.is_active
    )
  from public.merchant_branches mb
  join public.branch_inventory bi
    on bi.branch_id = mb.id
   and bi.shop_id = mb.shop_id
   and bi.variant_id = p_variant_id
  join public.product_variants pv
    on pv.id = bi.variant_id
   and pv.shop_id = mb.shop_id
   and pv.is_active
  join public.products product
    on product.id = pv.product_id
   and product.shop_id = pv.shop_id
   and product.moderation_status = 'APPROVED'
   and product.is_active
   and product.deleted_at is null
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
  where mb.status = 'ACTIVE'
    and mb.verification_status = 'VERIFIED'
    and mb.geography_status = 'VERIFIED'
    and mb.postal_delivery_enabled
    and bi.available_quantity >= p_quantity
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
  order by
    exists (
      select 1
      from public.branch_postal_serviceability bps
      where bps.branch_id = mb.id
        and bps.pincode = p_pincode
        and bps.is_active
    ) desc,
    bi.available_quantity desc,
    mb.average_preparation_minutes,
    mb.id
  limit 1;
$$;

create or replace function private.local_fulfilment_unavailability_reason(
  p_variant_id uuid,
  p_quantity integer,
  p_city_id uuid,
  p_service_zone_id uuid,
  p_customer_location extensions.geography
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.merchant_branches mb
      join public.branch_service_zones bsz
        on bsz.branch_id = mb.id
       and bsz.city_id = mb.city_id
       and bsz.service_zone_id = p_service_zone_id
       and bsz.is_active
      join public.branch_inventory bi
        on bi.branch_id = mb.id
       and bi.variant_id = p_variant_id
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
      join public.city_configurations cc
        on cc.city_id = mb.city_id
       and cc.local_delivery_enabled
      join public.service_zones zone
        on zone.id = bsz.service_zone_id
       and zone.status = 'ACTIVE'
      where mb.city_id = p_city_id
        and mb.status = 'ACTIVE'
        and mb.verification_status = 'VERIFIED'
        and mb.geography_status = 'VERIFIED'
        and mb.local_delivery_enabled
        and extensions.st_dwithin(
          mb.location,
          p_customer_location,
          least(
            cc.maximum_delivery_radius_meters,
            coalesce(
              zone.default_delivery_radius_meters,
              cc.default_delivery_radius_meters
            )
          )
        )
        and bi.available_quantity < p_quantity
    ) then 'INSUFFICIENT_BRANCH_STOCK'
    else 'NO_LOCAL_BRANCH'
  end;
$$;

create or replace function private.postal_fulfilment_unavailability_reason(
  p_variant_id uuid,
  p_quantity integer,
  p_pincode text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.merchant_branches mb
      join public.branch_inventory bi
        on bi.branch_id = mb.id
       and bi.variant_id = p_variant_id
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
      where mb.status = 'ACTIVE'
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
        and bi.available_quantity < p_quantity
    ) then 'INSUFFICIENT_BRANCH_STOCK'
    when exists (
      select 1
      from public.merchant_branches mb
      join public.branch_inventory bi
        on bi.branch_id = mb.id
       and bi.variant_id = p_variant_id
      join public.cities city
        on city.id = mb.city_id
       and city.status = 'ACTIVE'
      join public.city_configurations cc
        on cc.city_id = city.id
       and cc.postal_delivery_enabled
      where mb.status = 'ACTIVE'
        and mb.verification_status = 'VERIFIED'
        and mb.geography_status = 'VERIFIED'
        and mb.postal_delivery_enabled
        and not mb.all_india_postal_enabled
        and not exists (
          select 1
          from public.branch_postal_serviceability bps
          where bps.branch_id = mb.id
            and bps.pincode = p_pincode
            and bps.is_active
        )
    ) then 'PINCODE_NOT_SUPPORTED'
    else 'NO_POSTAL_BRANCH'
  end;
$$;

create or replace function public.resolve_customer_service_area(
  p_latitude double precision,
  p_longitude double precision,
  p_pincode text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.resolve_customer_service_area_internal(
    p_latitude,
    p_longitude,
    p_pincode
  );
$$;

create or replace function public.get_variant_serviceability_quote(
  p_variant_id uuid,
  p_quantity integer,
  p_latitude double precision,
  p_longitude double precision,
  p_pincode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_at timestamptz := statement_timestamp();
  v_expires_at timestamptz := statement_timestamp() + interval '5 minutes';
  v_customer_location extensions.geography(Point, 4326);
  v_area jsonb;
  v_local record;
  v_postal record;
  v_local_found boolean := false;
  v_postal_found boolean := false;
  v_local_reason text;
  v_postal_reason text;
  v_selected_mode public.fulfilment_mode;
  v_quote_id uuid;
  v_selected_branch_id uuid;
  v_selected_shop_id uuid;
  v_selected_city_id uuid;
  v_selected_zone_id uuid;
  v_available_quantity integer;
  v_inventory_version integer;
  v_configuration_version integer;
  v_distance_meters integer;
  v_delivery_fee_paise bigint;
  v_preparation_minutes integer;
  v_delivery_minutes integer;
  v_dispatch_hours integer;
  v_cod_limit_paise bigint;
  v_cod_eligible boolean;
  v_payment_mode text;
  v_unit_price_paise bigint;
  v_top_reason text;
  v_local_payload jsonb;
  v_postal_payload jsonb;
begin
  if p_variant_id is null
    or p_quantity is null
    or p_quantity < 1
    or p_quantity > 99
    or p_latitude is null
    or not (p_latitude between -90 and 90)
    or p_longitude is null
    or not (p_longitude between -180 and 180)
    or p_pincode is null
    or p_pincode !~ '^[1-9][0-9]{5}$'
  then
    raise exception 'INVALID_SERVICEABILITY_QUOTE_INPUT'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.product_variants pv
    join public.products product
      on product.id = pv.product_id
     and product.shop_id = pv.shop_id
    where pv.id = p_variant_id
      and pv.is_active
      and product.moderation_status = 'APPROVED'
      and product.is_active
      and product.deleted_at is null
  ) then
    return jsonb_build_object(
      'quoteId', null,
      'serviceable', false,
      'fulfilmentMode', null,
      'variantId', p_variant_id,
      'requestedQuantity', p_quantity,
      'localDelivery',
        jsonb_build_object(
          'available', false,
          'reasonCode', 'VARIANT_NOT_AVAILABLE'
        ),
      'postalDelivery',
        jsonb_build_object(
          'available', false,
          'reasonCode', 'VARIANT_NOT_AVAILABLE'
        ),
      'reasonCode', 'VARIANT_NOT_AVAILABLE',
      'expiresAt', null,
      'createdAt', v_created_at
    );
  end if;

  v_customer_location := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
  )::extensions.geography;

  v_area := private.resolve_customer_service_area_internal(
    p_latitude,
    p_longitude,
    p_pincode
  );

  if coalesce((v_area ->> 'resolved')::boolean, false) then
    if coalesce((v_area ->> 'localDeliveryEnabled')::boolean, false) then
      select *
      into v_local
      from private.find_local_fulfilment_branch(
        p_variant_id,
        p_quantity,
        (v_area ->> 'cityId')::uuid,
        (v_area ->> 'serviceZoneId')::uuid,
        v_customer_location
      );

      v_local_found := found;

      if v_local_found then
        v_local_reason := null;
      else
        v_local_reason := private.local_fulfilment_unavailability_reason(
          p_variant_id,
          p_quantity,
          (v_area ->> 'cityId')::uuid,
          (v_area ->> 'serviceZoneId')::uuid,
          v_customer_location
        );
      end if;
    else
      v_local_reason := 'LOCAL_DELIVERY_DISABLED';
    end if;
  else
    v_local_reason := v_area ->> 'reasonCode';
  end if;

  select *
  into v_postal
  from private.find_postal_fulfilment_branch(
    p_variant_id,
    p_quantity,
    p_pincode
  );

  v_postal_found := found;

  if v_postal_found then
    v_postal_reason := null;
  else
    v_postal_reason := private.postal_fulfilment_unavailability_reason(
      p_variant_id,
      p_quantity,
      p_pincode
    );
  end if;

  if v_local_found then
    v_local_payload := jsonb_build_object(
      'available', true,
      'reasonCode', null,
      'branchId', v_local.branch_id,
      'shopId', v_local.shop_id,
      'cityId', v_local.city_id,
      'serviceZoneId', v_local.service_zone_id,
      'availableQuantity', v_local.available_quantity,
      'distanceMeters', v_local.distance_meters,
      'distanceKm',
        round(v_local.distance_meters::numeric / 1000, 3),
      'deliveryFeePaise', v_local.delivery_fee_paise,
      'estimatedPreparationMinutes',
        v_local.estimated_preparation_minutes,
      'estimatedDeliveryMinutes',
        v_local.estimated_delivery_minutes,
      'codEligible',
        (
          p_quantity::bigint * v_local.unit_price_paise
          + v_local.delivery_fee_paise
        ) <= v_local.cod_limit_paise,
      'codLimitPaise', v_local.cod_limit_paise,
      'paymentMode', 'COD_OR_PREPAID',
      'branchInventoryVersion',
        v_local.branch_inventory_version,
      'cityConfigurationVersion',
        v_local.city_configuration_version
    );
  else
    v_local_payload := jsonb_build_object(
      'available', false,
      'reasonCode', v_local_reason
    );
  end if;

  if v_postal_found then
    v_postal_payload := jsonb_build_object(
      'available', true,
      'reasonCode', null,
      'branchId', v_postal.branch_id,
      'shopId', v_postal.shop_id,
      'cityId', v_postal.city_id,
      'serviceZoneId', null,
      'availableQuantity', v_postal.available_quantity,
      'distanceMeters', null,
      'distanceKm', null,
      'deliveryFeePaise', null,
      'deliveryFeeStatus', 'CALCULATED_AT_CHECKOUT',
      'estimatedPreparationMinutes',
        v_postal.estimated_preparation_minutes,
      'estimatedDeliveryMinutes', null,
      'estimatedDispatchHours',
        v_postal.estimated_dispatch_hours,
      'codEligible', false,
      'codLimitPaise', 0,
      'paymentMode', 'PREPAID_ONLY',
      'branchInventoryVersion',
        v_postal.branch_inventory_version,
      'cityConfigurationVersion',
        v_postal.city_configuration_version,
      'explicitPincodeMatch',
        v_postal.explicit_pincode_match
    );
  else
    v_postal_payload := jsonb_build_object(
      'available', false,
      'reasonCode', v_postal_reason
    );
  end if;

  if v_local_found then
    v_selected_mode := 'LOCAL_DELIVERY';
    v_selected_branch_id := v_local.branch_id;
    v_selected_shop_id := v_local.shop_id;
    v_selected_city_id := v_local.city_id;
    v_selected_zone_id := v_local.service_zone_id;
    v_available_quantity := v_local.available_quantity;
    v_inventory_version := v_local.branch_inventory_version;
    v_configuration_version := v_local.city_configuration_version;
    v_distance_meters := v_local.distance_meters;
    v_delivery_fee_paise := v_local.delivery_fee_paise;
    v_preparation_minutes := v_local.estimated_preparation_minutes;
    v_delivery_minutes := v_local.estimated_delivery_minutes;
    v_dispatch_hours := null;
    v_cod_limit_paise := v_local.cod_limit_paise;
    v_unit_price_paise := v_local.unit_price_paise;
    v_cod_eligible :=
      (
        p_quantity::bigint * v_unit_price_paise
        + v_delivery_fee_paise
      ) <= v_cod_limit_paise;
    v_payment_mode := 'COD_OR_PREPAID';
  elsif v_postal_found then
    v_selected_mode := 'POSTAL_DELIVERY';
    v_selected_branch_id := v_postal.branch_id;
    v_selected_shop_id := v_postal.shop_id;
    v_selected_city_id := v_postal.city_id;
    v_selected_zone_id := null;
    v_available_quantity := v_postal.available_quantity;
    v_inventory_version := v_postal.branch_inventory_version;
    v_configuration_version := v_postal.city_configuration_version;
    v_distance_meters := null;
    v_delivery_fee_paise := null;
    v_preparation_minutes := v_postal.estimated_preparation_minutes;
    v_delivery_minutes := null;
    v_dispatch_hours := v_postal.estimated_dispatch_hours;
    v_cod_limit_paise := 0;
    v_cod_eligible := false;
    v_payment_mode := 'PREPAID_ONLY';
  else
    v_top_reason := case
      when v_local_reason in (
        'CITY_PAUSED',
        'ZONE_PAUSED',
        'LOCATION_OUTSIDE_ZONE',
        'PINCODE_NOT_SUPPORTED',
        'CITY_NOT_SUPPORTED',
        'ZONE_NOT_FOUND'
      ) then v_local_reason
      when v_local_reason = 'INSUFFICIENT_BRANCH_STOCK'
        or v_postal_reason = 'INSUFFICIENT_BRANCH_STOCK'
      then 'INSUFFICIENT_BRANCH_STOCK'
      else coalesce(v_local_reason, v_postal_reason, 'NOT_SERVICEABLE')
    end;

    return jsonb_build_object(
      'quoteId', null,
      'serviceable', false,
      'fulfilmentMode', null,
      'cityId',
        nullif(v_area ->> 'cityId', '')::uuid,
      'serviceZoneId',
        nullif(v_area ->> 'serviceZoneId', '')::uuid,
      'branchId', null,
      'shopId', null,
      'variantId', p_variant_id,
      'requestedQuantity', p_quantity,
      'availableQuantity', 0,
      'distanceMeters', null,
      'distanceKm', null,
      'deliveryFeePaise', null,
      'estimatedPreparationMinutes', null,
      'estimatedDeliveryMinutes', null,
      'estimatedDispatchHours', null,
      'codEligible', false,
      'codLimitPaise', 0,
      'paymentMode', null,
      'branchInventoryVersion', null,
      'cityConfigurationVersion', null,
      'localDelivery', v_local_payload,
      'postalDelivery', v_postal_payload,
      'reasonCode', v_top_reason,
      'expiresAt', null,
      'createdAt', v_created_at
    );
  end if;

  v_quote_id := gen_random_uuid();

  insert into private.variant_serviceability_quotes (
    id,
    variant_id,
    shop_id,
    branch_id,
    city_id,
    service_zone_id,
    fulfilment_mode,
    requested_quantity,
    pincode,
    customer_location,
    available_quantity,
    distance_meters,
    delivery_fee_paise,
    estimated_preparation_minutes,
    estimated_delivery_minutes,
    estimated_dispatch_hours,
    cod_eligible,
    cod_limit_paise,
    payment_mode,
    branch_inventory_version,
    city_configuration_version,
    created_at,
    expires_at
  )
  values (
    v_quote_id,
    p_variant_id,
    v_selected_shop_id,
    v_selected_branch_id,
    v_selected_city_id,
    v_selected_zone_id,
    v_selected_mode,
    p_quantity,
    p_pincode,
    v_customer_location,
    v_available_quantity,
    v_distance_meters,
    v_delivery_fee_paise,
    v_preparation_minutes,
    v_delivery_minutes,
    v_dispatch_hours,
    v_cod_eligible,
    v_cod_limit_paise,
    v_payment_mode,
    v_inventory_version,
    v_configuration_version,
    v_created_at,
    v_expires_at
  );

  return jsonb_build_object(
    'quoteId', v_quote_id,
    'serviceable', true,
    'fulfilmentMode', v_selected_mode,
    'cityId', v_selected_city_id,
    'serviceZoneId', v_selected_zone_id,
    'branchId', v_selected_branch_id,
    'shopId', v_selected_shop_id,
    'variantId', p_variant_id,
    'requestedQuantity', p_quantity,
    'availableQuantity', v_available_quantity,
    'distanceMeters', v_distance_meters,
    'distanceKm',
      case
        when v_distance_meters is null then null
        else round(v_distance_meters::numeric / 1000, 3)
      end,
    'deliveryFeePaise', v_delivery_fee_paise,
    'deliveryFeeStatus',
      case
        when v_selected_mode = 'POSTAL_DELIVERY'
          then 'CALCULATED_AT_CHECKOUT'
        else 'FINAL'
      end,
    'estimatedPreparationMinutes', v_preparation_minutes,
    'estimatedDeliveryMinutes', v_delivery_minutes,
    'estimatedDispatchHours', v_dispatch_hours,
    'codEligible', v_cod_eligible,
    'codLimitPaise', v_cod_limit_paise,
    'paymentMode', v_payment_mode,
    'branchInventoryVersion', v_inventory_version,
    'cityConfigurationVersion', v_configuration_version,
    'localDelivery', v_local_payload,
    'postalDelivery', v_postal_payload,
    'reasonCode', null,
    'expiresAt', v_expires_at,
    'createdAt', v_created_at
  );
end;
$$;

create or replace function public.revalidate_serviceability_quote(
  p_quote_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote private.variant_serviceability_quotes;
  v_branch public.merchant_branches;
  v_city public.cities;
  v_configuration public.city_configurations;
  v_zone public.service_zones;
  v_inventory public.branch_inventory;
  v_distance_meters integer;
  v_delivery_radius_meters integer;
  v_delivery_fee_paise bigint;
begin
  if p_quote_id is null
    or p_variant_id is null
    or p_quantity is null
    or p_quantity < 1
    or p_quantity > 99
  then
    raise exception 'INVALID_SERVICEABILITY_REVALIDATION_INPUT'
      using errcode = '22023';
  end if;

  select *
  into v_quote
  from private.variant_serviceability_quotes quote
  where quote.id = p_quote_id;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'QUOTE_NOT_FOUND'
    );
  end if;

  if v_quote.variant_id <> p_variant_id
    or v_quote.requested_quantity <> p_quantity
  then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'QUOTE_REQUEST_MISMATCH'
    );
  end if;

  if v_quote.expires_at <= statement_timestamp() then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'QUOTE_EXPIRED'
    );
  end if;

  select *
  into v_branch
  from public.merchant_branches mb
  where mb.id = v_quote.branch_id;

  if not found
    or v_branch.status <> 'ACTIVE'
    or v_branch.verification_status <> 'VERIFIED'
    or v_branch.geography_status <> 'VERIFIED'
  then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'BRANCH_UNAVAILABLE'
    );
  end if;

  if not exists (
    select 1
    from public.shops shop
    join public.merchant_profiles merchant
      on merchant.user_id = v_branch.merchant_id
    join public.profiles profile
      on profile.id = v_branch.merchant_id
    join public.product_variants pv
      on pv.id = v_quote.variant_id
     and pv.shop_id = shop.id
     and pv.is_active
    join public.products product
      on product.id = pv.product_id
     and product.shop_id = pv.shop_id
    where shop.id = v_quote.shop_id
      and shop.deleted_at is null
      and shop.verification_status = 'VERIFIED'
      and shop.operational_status in ('OPEN', 'BUSY')
      and shop.accepts_online_orders
      and merchant.kyc_status = 'VERIFIED'
      and merchant.onboarding_status = 'ACTIVE'
      and profile.status = 'ACTIVE'
      and product.moderation_status = 'APPROVED'
      and product.is_active
      and product.deleted_at is null
  ) then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'BRANCH_UNAVAILABLE'
    );
  end if;

  select *
  into v_city
  from public.cities c
  where c.id = v_quote.city_id;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'CITY_NOT_SUPPORTED'
    );
  end if;

  if v_city.status <> 'ACTIVE' then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode',
        case
          when v_city.status = 'PAUSED' then 'CITY_PAUSED'
          else 'CITY_NOT_SUPPORTED'
        end
    );
  end if;

  select *
  into strict v_configuration
  from public.city_configurations cc
  where cc.city_id = v_quote.city_id;

  if v_configuration.version <> v_quote.city_configuration_version then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'CITY_CONFIGURATION_CHANGED'
    );
  end if;

  select *
  into v_inventory
  from public.branch_inventory bi
  where bi.branch_id = v_quote.branch_id
    and bi.variant_id = v_quote.variant_id;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'INSUFFICIENT_BRANCH_STOCK'
    );
  end if;

  if v_inventory.version <> v_quote.branch_inventory_version then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'BRANCH_INVENTORY_CHANGED'
    );
  end if;

  if v_inventory.available_quantity < v_quote.requested_quantity then
    return jsonb_build_object(
      'valid', false,
      'quoteId', p_quote_id,
      'reasonCode', 'INSUFFICIENT_BRANCH_STOCK'
    );
  end if;

  if v_quote.fulfilment_mode = 'LOCAL_DELIVERY' then
    if not v_configuration.local_delivery_enabled
      or not v_branch.local_delivery_enabled
    then
      return jsonb_build_object(
        'valid', false,
        'quoteId', p_quote_id,
        'reasonCode', 'LOCAL_DELIVERY_DISABLED'
      );
    end if;

    select *
    into v_zone
    from public.service_zones zone
    where zone.id = v_quote.service_zone_id
      and zone.city_id = v_quote.city_id;

    if not found then
      return jsonb_build_object(
        'valid', false,
        'quoteId', p_quote_id,
        'reasonCode', 'ZONE_NOT_FOUND'
      );
    end if;

    if v_zone.status <> 'ACTIVE' then
      return jsonb_build_object(
        'valid', false,
        'quoteId', p_quote_id,
        'reasonCode',
          case
            when v_zone.status = 'PAUSED' then 'ZONE_PAUSED'
            else 'ZONE_NOT_FOUND'
          end
      );
    end if;

    if not exists (
      select 1
      from public.branch_service_zones bsz
      where bsz.branch_id = v_quote.branch_id
        and bsz.city_id = v_quote.city_id
        and bsz.service_zone_id = v_quote.service_zone_id
        and bsz.is_active
    ) then
      return jsonb_build_object(
        'valid', false,
        'quoteId', p_quote_id,
        'reasonCode', 'SERVICEABILITY_CHANGED'
      );
    end if;

    if not exists (
      select 1
      from public.service_zone_pincodes szp
      where szp.city_id = v_quote.city_id
        and szp.service_zone_id = v_quote.service_zone_id
        and szp.pincode = v_quote.pincode
        and szp.is_active
    ) then
      return jsonb_build_object(
        'valid', false,
        'quoteId', p_quote_id,
        'reasonCode', 'PINCODE_NOT_SUPPORTED'
      );
    end if;

    if v_zone.boundary is not null
      and not extensions.st_covers(
        v_zone.boundary,
        v_quote.customer_location::extensions.geometry
      )
    then
      return jsonb_build_object(
        'valid', false,
        'quoteId', p_quote_id,
        'reasonCode', 'LOCATION_OUTSIDE_ZONE'
      );
    end if;

    v_distance_meters := round(
      extensions.st_distance(
        v_branch.location,
        v_quote.customer_location
      )
    )::integer;

    v_delivery_radius_meters := least(
      v_configuration.maximum_delivery_radius_meters,
      coalesce(
        v_zone.default_delivery_radius_meters,
        v_configuration.default_delivery_radius_meters
      )
    );

    if v_distance_meters > v_delivery_radius_meters then
      return jsonb_build_object(
        'valid', false,
        'quoteId', p_quote_id,
        'reasonCode', 'SERVICEABILITY_CHANGED'
      );
    end if;

    v_delivery_fee_paise :=
      v_configuration.base_delivery_fee_paise
      + ceil(
          v_distance_meters::numeric
          * v_configuration.per_km_delivery_fee_paise::numeric
          / 1000
        )::bigint;

    if v_delivery_fee_paise <> v_quote.delivery_fee_paise then
      return jsonb_build_object(
        'valid', false,
        'quoteId', p_quote_id,
        'reasonCode', 'SERVICEABILITY_CHANGED'
      );
    end if;
  else
    if not v_configuration.postal_delivery_enabled
      or not v_branch.postal_delivery_enabled
      or not (
        v_branch.all_india_postal_enabled
        or exists (
          select 1
          from public.branch_postal_serviceability bps
          where bps.branch_id = v_quote.branch_id
            and bps.pincode = v_quote.pincode
            and bps.is_active
        )
      )
    then
      return jsonb_build_object(
        'valid', false,
        'quoteId', p_quote_id,
        'reasonCode', 'POSTAL_SERVICEABILITY_CHANGED'
      );
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'quoteId', v_quote.id,
    'reasonCode', null,
    'fulfilmentMode', v_quote.fulfilment_mode,
    'branchId', v_quote.branch_id,
    'cityId', v_quote.city_id,
    'serviceZoneId', v_quote.service_zone_id,
    'variantId', v_quote.variant_id,
    'requestedQuantity', v_quote.requested_quantity,
    'availableQuantity', v_inventory.available_quantity,
    'branchInventoryVersion', v_inventory.version,
    'cityConfigurationVersion', v_configuration.version,
    'expiresAt', v_quote.expires_at
  );
end;
$$;

comment on function public.resolve_customer_service_area(
  double precision,
  double precision,
  text
) is
  'Resolves an address to one active city and service zone using pincode validation and optional PostGIS geofences.';

comment on function public.get_variant_serviceability_quote(
  uuid,
  integer,
  double precision,
  double precision,
  text
) is
  'Creates a five-minute branch-aware local or postal catalogue quote without reserving inventory.';

comment on function public.revalidate_serviceability_quote(
  uuid,
  uuid,
  integer
) is
  'Revalidates quote expiry, branch lifecycle, city and zone state, inventory version, quantity, delivery fee, and postal coverage.';

revoke all
on function private.resolve_customer_service_area_internal(
  double precision,
  double precision,
  text
)
from public, anon, authenticated;

revoke all
on function private.find_local_fulfilment_branch(
  uuid,
  integer,
  uuid,
  uuid,
  extensions.geography
)
from public, anon, authenticated;

revoke all
on function private.find_postal_fulfilment_branch(
  uuid,
  integer,
  text
)
from public, anon, authenticated;

revoke all
on function private.local_fulfilment_unavailability_reason(
  uuid,
  integer,
  uuid,
  uuid,
  extensions.geography
)
from public, anon, authenticated;

revoke all
on function private.postal_fulfilment_unavailability_reason(
  uuid,
  integer,
  text
)
from public, anon, authenticated;

revoke all
on function public.resolve_customer_service_area(
  double precision,
  double precision,
  text
)
from public, anon;

revoke all
on function public.get_variant_serviceability_quote(
  uuid,
  integer,
  double precision,
  double precision,
  text
)
from public, anon;

revoke all
on function public.revalidate_serviceability_quote(
  uuid,
  uuid,
  integer
)
from public, anon;

grant execute
on function public.resolve_customer_service_area(
  double precision,
  double precision,
  text
)
to authenticated, service_role;

grant execute
on function public.get_variant_serviceability_quote(
  uuid,
  integer,
  double precision,
  double precision,
  text
)
to authenticated, service_role;

grant execute
on function public.revalidate_serviceability_quote(
  uuid,
  uuid,
  integer
)
to authenticated, service_role;
