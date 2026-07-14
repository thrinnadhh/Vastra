-- S4-02: public shop detail with customer-relative serviceability.
--
-- Existing public-shop RLS remains authoritative because this function executes
-- as the authenticated caller. Opening-hour interpretation remains in the API,
-- where Asia/Kolkata is explicit for the India-first MVP.

create or replace function public.get_public_shop_detail(
  p_shop_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  phone_number text,
  email text,
  latitude double precision,
  longitude double precision,
  operational_status text,
  accepts_online_orders boolean,
  distance_meters integer,
  service_radius_meters integer,
  is_serviceable boolean,
  minimum_order_paise bigint,
  average_preparation_minutes integer,
  rating_average numeric,
  rating_count integer,
  follower_count integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_customer_location extensions.geography(point, 4326);
begin
  if p_shop_id is null
    or p_latitude is null
    or not (p_latitude between -90 and 90)
    or p_longitude is null
    or not (p_longitude between -180 and 180)
  then
    raise exception using
      errcode = '22023',
      message = 'invalid public shop-detail query';
  end if;

  v_customer_location :=
    extensions.st_setsrid(
      extensions.st_makepoint(p_longitude, p_latitude),
      4326
    )::extensions.geography;

  return query
  select
    shop.id,
    shop.name,
    shop.slug,
    shop.description,
    shop.phone_number,
    shop.email,
    extensions.st_y(
      shop.location::extensions.geometry
    )::double precision as latitude,
    extensions.st_x(
      shop.location::extensions.geometry
    )::double precision as longitude,
    shop.operational_status::text,
    shop.accepts_online_orders,
    round(
      extensions.st_distance(
        shop.location,
        v_customer_location
      )
    )::integer as distance_meters,
    shop.service_radius_meters::integer,
    extensions.st_dwithin(
      shop.location,
      v_customer_location,
      shop.service_radius_meters
    ) as is_serviceable,
    shop.minimum_order_paise::bigint,
    shop.average_preparation_minutes::integer,
    shop.rating_average::numeric,
    shop.rating_count::integer,
    shop.follower_count::integer
  from public.shops shop
  where shop.id = p_shop_id
    and shop.deleted_at is null
    and shop.verification_status = 'VERIFIED'
    and shop.operational_status not in ('PAUSED', 'SUSPENDED');
end;
$$;

comment on function public.get_public_shop_detail(
  uuid,
  double precision,
  double precision
) is
  'Returns one public shop with customer-relative distance and serviceability.';

revoke all privileges
on function public.get_public_shop_detail(
  uuid,
  double precision,
  double precision
)
from public, anon;

grant execute
on function public.get_public_shop_detail(
  uuid,
  double precision,
  double precision
)
to authenticated;
