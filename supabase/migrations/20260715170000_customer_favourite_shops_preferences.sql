-- Customer-owned favourite shops and discovery preferences.
--
-- Both resources use forced row-level security. The favourite mutation RPC is
-- security invoker and derives ownership exclusively from auth.uid().

create function public.preference_text_array_is_valid(
  p_values text[],
  p_max_items integer,
  p_max_length integer
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    p_values is not null
    and cardinality(p_values) <= p_max_items
    and not exists (
      select 1
      from unnest(p_values) as item(value)
      where item.value <> btrim(item.value)
        or length(item.value) = 0
        or length(item.value) > p_max_length
    )
    and cardinality(p_values) = (
      select count(distinct lower(item.value))::integer
      from unnest(p_values) as item(value)
    );
$$;

create function public.preference_colour_array_is_valid(p_values text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    public.preference_text_array_is_valid(p_values, 12, 7)
    and not exists (
      select 1
      from unnest(p_values) as item(value)
      where item.value !~ '^#[0-9A-F]{6}$'
    );
$$;

create table public.customer_favourite_shops (
  customer_id uuid not null,
  shop_id uuid not null,
  created_at timestamptz not null default now(),

  constraint customer_favourite_shops_pkey
    primary key (customer_id, shop_id),

  constraint customer_favourite_shops_customer_id_fkey
    foreign key (customer_id)
    references public.customer_profiles (user_id)
    on update cascade
    on delete cascade,

  constraint customer_favourite_shops_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete cascade
);

comment on table public.customer_favourite_shops is
  'Customer-owned, idempotent favourite-shop relationships.';

create index customer_favourite_shops_shop_created_idx
on public.customer_favourite_shops (shop_id, created_at desc);

create table public.customer_preferences (
  customer_id uuid primary key,
  gender_categories public.product_gender_category[] not null default '{}',
  style_tags text[] not null default '{}',
  occasion_tags text[] not null default '{}',
  preferred_colours text[] not null default '{}',
  preferred_sizes text[] not null default '{}',
  min_price_paise public.money_paise,
  max_price_paise public.money_paise,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_preferences_customer_id_fkey
    foreign key (customer_id)
    references public.customer_profiles (user_id)
    on update cascade
    on delete cascade,

  constraint customer_preferences_gender_categories_check
    check (
      public.preference_text_array_is_valid(
        gender_categories::text[],
        4,
        10
      )
    ),

  constraint customer_preferences_style_tags_check
    check (public.preference_text_array_is_valid(style_tags, 20, 40)),

  constraint customer_preferences_occasion_tags_check
    check (public.preference_text_array_is_valid(occasion_tags, 20, 40)),

  constraint customer_preferences_colours_check
    check (public.preference_colour_array_is_valid(preferred_colours)),

  constraint customer_preferences_sizes_check
    check (public.preference_text_array_is_valid(preferred_sizes, 20, 20)),

  constraint customer_preferences_price_range_check
    check (
      min_price_paise is null
      or max_price_paise is null
      or min_price_paise <= max_price_paise
    )
);

comment on table public.customer_preferences is
  'Customer-controlled discovery and recommendation preference profile.';

create trigger set_customer_preferences_updated_at
before update on public.customer_preferences
for each row
execute function public.set_updated_at();

create function public.adjust_shop_follower_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.shops
    set follower_count = follower_count + 1
    where id = new.shop_id;

    return new;
  end if;

  update public.shops
  set follower_count = greatest(follower_count - 1, 0)
  where id = old.shop_id;

  return old;
end;
$$;

revoke all
on function public.adjust_shop_follower_count()
from public, anon, authenticated;

create trigger adjust_shop_follower_count_after_favourite
  after insert or delete
  on public.customer_favourite_shops
  for each row
  execute function public.adjust_shop_follower_count();

alter table public.customer_favourite_shops enable row level security;
alter table public.customer_favourite_shops force row level security;
alter table public.customer_preferences enable row level security;
alter table public.customer_preferences force row level security;

grant select, insert, update, delete
on table
  public.customer_favourite_shops,
  public.customer_preferences
to authenticated;

create policy customer_favourite_shops_self_access
on public.customer_favourite_shops
for all
to authenticated
using (customer_id = (select auth.uid()))
with check (
  customer_id = (select auth.uid())
  and authz.is_public_shop(shop_id)
);

create policy customer_favourite_shops_admin_read
on public.customer_favourite_shops
for select
to authenticated
using (authz.is_admin());

create policy customer_preferences_self_access
on public.customer_preferences
for all
to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

create policy customer_preferences_admin_read
on public.customer_preferences
for select
to authenticated
using (authz.is_admin());

create function public.list_customer_favourite_shops()
returns table (
  shop_id uuid,
  shop_name text,
  shop_slug text,
  logo_object_key text,
  cover_image_object_key text,
  operational_status public.shop_operational_status,
  accepts_online_orders boolean,
  rating_average public.rating_value,
  rating_count public.non_negative_quantity,
  follower_count public.non_negative_quantity,
  favourited_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    shop.id,
    shop.name,
    shop.slug,
    shop.logo_object_key,
    shop.cover_image_object_key,
    shop.operational_status,
    shop.accepts_online_orders,
    shop.rating_average,
    shop.rating_count,
    shop.follower_count,
    favourite.created_at
  from public.customer_favourite_shops as favourite
  join public.shops as shop
    on shop.id = favourite.shop_id
  where favourite.customer_id = (select auth.uid())
    and authz.is_public_shop(shop.id)
  order by favourite.created_at desc, shop.id;
$$;

create function public.set_customer_favourite_shop(
  p_shop_id uuid,
  p_favourite boolean
)
returns table (
  shop_id uuid,
  is_favourite boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  current_customer_id uuid := auth.uid();
begin
  if current_customer_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if p_favourite then
    if not exists (
      select 1
      from public.shops as shop
      where shop.id = p_shop_id
        and authz.is_public_shop(shop.id)
    ) then
      raise exception using
        errcode = 'P0002',
        message = 'Shop is not available to customers';
    end if;

    insert into public.customer_favourite_shops (
      customer_id,
      shop_id
    )
    values (
      current_customer_id,
      p_shop_id
    )
    on conflict on constraint customer_favourite_shops_pkey do nothing;
  else
    delete from public.customer_favourite_shops as favourite
    where favourite.customer_id = current_customer_id
      and favourite.shop_id = p_shop_id;
  end if;

  return query
  select p_shop_id, p_favourite;
end;
$$;

revoke all
on function public.list_customer_favourite_shops()
from public, anon;

revoke all
on function public.set_customer_favourite_shop(uuid, boolean)
from public, anon;

grant execute
on function public.list_customer_favourite_shops()
to authenticated;

grant execute
on function public.set_customer_favourite_shop(uuid, boolean)
to authenticated;
