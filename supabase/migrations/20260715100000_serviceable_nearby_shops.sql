-- S4-01: customer serviceability and nearby-shop discovery.
--
-- The RPC executes as the authenticated caller, so existing public-shop RLS is
-- still authoritative. A shop is returned only when the requested location is
-- within that shop's own service radius.

create or replace function public.list_serviceable_shops(
  p_latitude double precision,
  p_longitude double precision,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  operational_status text,
  accepts_online_orders boolean,
  distance_meters integer,
  service_radius_meters integer,
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
  v_location extensions.geography(point, 4326);
begin
  if p_latitude is null
    or not (p_latitude between -90 and 90)
    or p_longitude is null
    or not (p_longitude between -180 and 180)
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
  then
    raise exception using
      errcode = '22023',
      message = 'invalid serviceable-shop query';
  end if;

  v_location :=
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
    shop.operational_status::text,
    shop.accepts_online_orders,
    round(
      extensions.st_distance(shop.location, v_location)
    )::integer as distance_meters,
    shop.service_radius_meters::integer,
    shop.minimum_order_paise::bigint,
    shop.average_preparation_minutes::integer,
    shop.rating_average::numeric,
    shop.rating_count::integer,
    shop.follower_count::integer
  from public.shops shop
  where shop.deleted_at is null
    and shop.verification_status = 'VERIFIED'
    and shop.operational_status not in ('PAUSED', 'SUSPENDED')
    and extensions.st_dwithin(
      shop.location,
      v_location,
      shop.service_radius_meters
    )
  order by
    extensions.st_distance(shop.location, v_location),
    shop.id
  limit p_limit;
end;
$$;

comment on function public.list_serviceable_shops(
  double precision,
  double precision,
  integer
) is
  'Lists public shops whose individual delivery radius covers a customer location.';

revoke all privileges
on function public.list_serviceable_shops(
  double precision,
  double precision,
  integer
)
from public, anon;

grant execute
on function public.list_serviceable_shops(
  double precision,
  double precision,
  integer
)
to authenticated;
