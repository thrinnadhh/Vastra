-- S4-03: serviceable customer product search and basic filters.
--
-- The search RPC is security invoker. Existing public shop, category, product,
-- and variant RLS remains authoritative. Inventory is not joined or exposed.

create or replace function public.build_product_discovery_search_vector(
  p_name text,
  p_brand text,
  p_description text,
  p_material text,
  p_style_tags text[],
  p_occasion_tags text[]
)
returns pg_catalog.tsvector
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'pg_catalog.simple'::pg_catalog.regconfig,
        coalesce(p_name, '')
      ),
      'A'
    )
    ||
    pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'pg_catalog.simple'::pg_catalog.regconfig,
        coalesce(p_brand, '')
      ),
      'B'
    )
    ||
    pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'pg_catalog.simple'::pg_catalog.regconfig,
        coalesce(p_description, '')
        || ' '
        || coalesce(p_material, '')
        || ' '
        || coalesce(
          pg_catalog.array_to_string(p_style_tags, ' '),
          ''
        )
        || ' '
        || coalesce(
          pg_catalog.array_to_string(p_occasion_tags, ' '),
          ''
        )
      ),
      'C'
    );
$$;

comment on function public.build_product_discovery_search_vector(
  text,
  text,
  text,
  text,
  text[],
  text[]
) is
  'Builds the weighted customer discovery document for a product.';

alter table public.products
add column discovery_search_vector pg_catalog.tsvector
generated always as (
  public.build_product_discovery_search_vector(
    name,
    brand,
    description,
    material,
    style_tags,
    occasion_tags
  )
) stored;

create index products_discovery_search_vector_gin_idx
on public.products
using gin (discovery_search_vector)
where moderation_status = 'APPROVED'
  and is_active
  and deleted_at is null;

create or replace function public.search_public_products(
  p_query text,
  p_latitude double precision,
  p_longitude double precision,
  p_category_id uuid default null,
  p_gender text default null,
  p_shop_id uuid default null,
  p_min_price_paise bigint default null,
  p_max_price_paise bigint default null,
  p_sort text default 'RELEVANCE',
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  product_id uuid,
  shop_id uuid,
  shop_name text,
  shop_slug text,
  shop_operational_status text,
  shop_accepts_online_orders boolean,
  distance_meters integer,
  relevance_score double precision,
  sort_price_paise bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_location extensions.geography(point, 4326);
  v_query pg_catalog.tsquery;
begin
  if p_query is null
    or pg_catalog.length(pg_catalog.btrim(p_query)) < 2
    or pg_catalog.length(pg_catalog.btrim(p_query)) > 100
    or p_latitude is null
    or not (p_latitude between -90 and 90)
    or p_longitude is null
    or not (p_longitude between -180 and 180)
    or (
      p_gender is not null
      and p_gender not in ('MEN', 'WOMEN', 'KIDS', 'UNISEX')
    )
    or p_min_price_paise < 0
    or p_max_price_paise < 0
    or (
      p_min_price_paise is not null
      and p_max_price_paise is not null
      and p_min_price_paise > p_max_price_paise
    )
    or p_sort not in (
      'RELEVANCE',
      'DISTANCE',
      'PRICE_ASC',
      'PRICE_DESC'
    )
    or p_offset is null
    or p_offset < 0
    or p_offset > 1000000
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
  then
    raise exception using
      errcode = '22023',
      message = 'invalid public product-search query';
  end if;

  v_query :=
    pg_catalog.websearch_to_tsquery(
      'pg_catalog.simple'::pg_catalog.regconfig,
      pg_catalog.btrim(p_query)
    );

  if pg_catalog.numnode(v_query) = 0 then
    raise exception using
      errcode = '22023',
      message = 'invalid public product-search query';
  end if;

  v_location :=
    extensions.st_setsrid(
      extensions.st_makepoint(p_longitude, p_latitude),
      4326
    )::extensions.geography;

  return query
  with ranked as (
    select
      product.id as candidate_product_id,
      shop.id as candidate_shop_id,
      shop.name as candidate_shop_name,
      shop.slug as candidate_shop_slug,
      shop.operational_status::text
        as candidate_shop_operational_status,
      shop.accepts_online_orders
        as candidate_shop_accepts_online_orders,
      pg_catalog.round(
        extensions.st_distance(shop.location, v_location)
      )::integer as candidate_distance_meters,
      pg_catalog.ts_rank_cd(
        product.discovery_search_vector,
        v_query
      )::double precision as candidate_relevance_score,
      price.minimum_price_paise as candidate_sort_price_paise
    from public.products product
    join public.shops shop
      on shop.id = product.shop_id
    join public.categories category
      on category.id = product.category_id
    join lateral (
      select
        pg_catalog.min(variant.selling_price_paise)::bigint
          as minimum_price_paise
      from public.product_variants variant
      where variant.product_id = product.id
        and variant.shop_id = product.shop_id
        and variant.is_active
        and (
          p_min_price_paise is null
          or variant.selling_price_paise >= p_min_price_paise
        )
        and (
          p_max_price_paise is null
          or variant.selling_price_paise <= p_max_price_paise
        )
    ) price
      on price.minimum_price_paise is not null
    where product.moderation_status = 'APPROVED'
      and product.is_active
      and product.deleted_at is null
      and category.is_active
      and shop.deleted_at is null
      and shop.verification_status = 'VERIFIED'
      and shop.operational_status not in ('PAUSED', 'SUSPENDED')
      and product.discovery_search_vector @@ v_query
      and (
        p_category_id is null
        or product.category_id = p_category_id
      )
      and (
        p_gender is null
        or product.gender_category::text = p_gender
      )
      and (
        p_shop_id is null
        or product.shop_id = p_shop_id
      )
      and extensions.st_dwithin(
        shop.location,
        v_location,
        shop.service_radius_meters
      )
  )
  select
    ranked.candidate_product_id,
    ranked.candidate_shop_id,
    ranked.candidate_shop_name,
    ranked.candidate_shop_slug,
    ranked.candidate_shop_operational_status,
    ranked.candidate_shop_accepts_online_orders,
    ranked.candidate_distance_meters,
    ranked.candidate_relevance_score,
    ranked.candidate_sort_price_paise
  from ranked
  order by
    case
      when p_sort = 'RELEVANCE'
      then ranked.candidate_relevance_score
    end desc nulls last,
    case
      when p_sort = 'DISTANCE'
      then ranked.candidate_distance_meters
    end asc nulls last,
    case
      when p_sort = 'PRICE_ASC'
      then ranked.candidate_sort_price_paise
    end asc nulls last,
    case
      when p_sort = 'PRICE_DESC'
      then ranked.candidate_sort_price_paise
    end desc nulls last,
    ranked.candidate_relevance_score desc,
    ranked.candidate_distance_meters asc,
    ranked.candidate_product_id asc
  offset p_offset
  limit p_limit;
end;
$$;

comment on function public.search_public_products(
  text,
  double precision,
  double precision,
  uuid,
  text,
  uuid,
  bigint,
  bigint,
  text,
  integer,
  integer
) is
  'Searches approved products from public shops that can serve a customer location.';

revoke all privileges
on function public.search_public_products(
  text,
  double precision,
  double precision,
  uuid,
  text,
  uuid,
  bigint,
  bigint,
  text,
  integer,
  integer
)
from public, anon;

grant execute
on function public.search_public_products(
  text,
  double precision,
  double precision,
  uuid,
  text,
  uuid,
  bigint,
  bigint,
  text,
  integer,
  integer
)
to authenticated;
