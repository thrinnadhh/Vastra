-- Vastra Phase 2B merchant branches and fulfilment locations.
--
-- Introduces branch-level fulfilment without destructively changing the
-- existing shop/catalogue contracts. A shop remains the customer-facing
-- catalogue and pricing boundary; one shop can now be fulfilled by multiple
-- physical or cloud branches.

create type public.merchant_branch_type as enum (
  'PHYSICAL_STORE',
  'CLOUD_SHOP'
);

create type public.merchant_branch_status as enum (
  'REGISTERED',
  'VERIFICATION_PENDING',
  'APPROVED',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'CLOSED'
);

create type public.branch_geography_status as enum (
  'REVIEW_REQUIRED',
  'VERIFIED',
  'REJECTED'
);

create table public.merchant_branches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  merchant_id uuid not null,
  city_id uuid not null,
  primary_service_zone_id uuid not null,
  branch_code text not null,
  name text not null,
  branch_type public.merchant_branch_type not null default 'PHYSICAL_STORE',
  address_id uuid not null,
  return_address_id uuid not null,
  pincode text,
  location extensions.geography(point, 4326) not null,
  verification_status public.shop_verification_status not null default 'PENDING',
  geography_status public.branch_geography_status not null default 'REVIEW_REQUIRED',
  status public.merchant_branch_status not null default 'REGISTERED',
  local_delivery_enabled boolean not null default false,
  postal_delivery_enabled boolean not null default false,
  all_india_postal_enabled boolean not null default false,
  accepts_walk_in boolean not null default true,
  postal_dispatch_sla_hours integer not null default 48,
  average_preparation_minutes public.non_negative_quantity not null default 15,
  is_primary boolean not null default false,
  migration_source text,
  activated_at timestamptz,
  paused_at timestamptz,
  suspended_at timestamptz,
  closed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint merchant_branches_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint merchant_branches_merchant_id_fkey
    foreign key (merchant_id)
    references public.merchant_profiles (user_id)
    on update cascade
    on delete restrict,

  constraint merchant_branches_city_id_fkey
    foreign key (city_id)
    references public.cities (id)
    on update cascade
    on delete restrict,

  constraint merchant_branches_primary_zone_city_fkey
    foreign key (primary_service_zone_id, city_id)
    references public.service_zones (id, city_id)
    on update cascade
    on delete restrict,

  constraint merchant_branches_address_id_fkey
    foreign key (address_id)
    references public.addresses (id)
    on update cascade
    on delete restrict,

  constraint merchant_branches_return_address_id_fkey
    foreign key (return_address_id)
    references public.addresses (id)
    on update cascade
    on delete restrict,

  constraint merchant_branches_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint merchant_branches_updated_by_fkey
    foreign key (updated_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint merchant_branches_id_shop_key unique (id, shop_id),
  constraint merchant_branches_id_city_key unique (id, city_id),
  constraint merchant_branches_merchant_code_key unique (merchant_id, branch_code),

  constraint merchant_branches_code_format
    check (branch_code ~ '^[A-Z][A-Z0-9_-]{1,63}$'),

  constraint merchant_branches_name_nonempty
    check (length(btrim(name)) > 0),

  constraint merchant_branches_pincode_format
    check (
      pincode is null
      or pincode ~ '^[1-9][0-9]{5}$'
    ),

  constraint merchant_branches_postal_dependency
    check (
      not all_india_postal_enabled
      or postal_delivery_enabled
    ),

  constraint merchant_branches_cloud_walkin
    check (
      branch_type <> 'CLOUD_SHOP'
      or not accepts_walk_in
    ),

  constraint merchant_branches_delivery_mode
    check (
      status <> 'ACTIVE'
      or local_delivery_enabled
      or postal_delivery_enabled
    ),

  constraint merchant_branches_postal_sla_range
    check (postal_dispatch_sla_hours between 1 and 720),

  constraint merchant_branches_migration_source_nonempty
    check (
      migration_source is null
      or length(btrim(migration_source)) > 0
    ),

  constraint merchant_branches_activated_after_creation
    check (activated_at is null or activated_at >= created_at),

  constraint merchant_branches_paused_after_creation
    check (paused_at is null or paused_at >= created_at),

  constraint merchant_branches_suspended_after_creation
    check (suspended_at is null or suspended_at >= created_at),

  constraint merchant_branches_closed_after_creation
    check (closed_at is null or closed_at >= created_at)
);

comment on table public.merchant_branches is
  'Physical and cloud fulfilment locations sharing a shop catalogue and prices.';

comment on table public.shops is
  'Customer-facing merchant catalogue and pricing boundary. Fulfilment locations live in merchant_branches.';

create unique index merchant_branches_one_primary_per_shop_idx
  on public.merchant_branches (shop_id)
  where is_primary and status <> 'CLOSED';

create index merchant_branches_city_status_idx
  on public.merchant_branches (city_id, status);

create index merchant_branches_shop_status_idx
  on public.merchant_branches (shop_id, status);

create index merchant_branches_location_gist_idx
  on public.merchant_branches
  using gist (location);

create table public.merchant_branch_hours (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  schedule_type public.shop_schedule_type not null default 'WEEKLY',
  day_of_week smallint,
  special_date date,
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint merchant_branch_hours_branch_id_fkey
    foreign key (branch_id)
    references public.merchant_branches (id)
    on update cascade
    on delete cascade,

  constraint merchant_branch_hours_schedule_shape
    check (
      (
        schedule_type = 'WEEKLY'
        and day_of_week between 0 and 6
        and special_date is null
      )
      or (
        schedule_type = 'SPECIAL_DATE'
        and day_of_week is null
        and special_date is not null
      )
    ),

  constraint merchant_branch_hours_time_shape
    check (
      (
        is_closed
        and open_time is null
        and close_time is null
      )
      or (
        not is_closed
        and open_time is not null
        and close_time is not null
        and open_time <> close_time
      )
    )
);

create unique index merchant_branch_hours_weekly_unique_idx
  on public.merchant_branch_hours (branch_id, day_of_week)
  where schedule_type = 'WEEKLY';

create unique index merchant_branch_hours_special_unique_idx
  on public.merchant_branch_hours (branch_id, special_date)
  where schedule_type = 'SPECIAL_DATE';

create table public.branch_service_zones (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  city_id uuid not null,
  service_zone_id uuid not null,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint branch_service_zones_branch_city_fkey
    foreign key (branch_id, city_id)
    references public.merchant_branches (id, city_id)
    on update cascade
    on delete cascade,

  constraint branch_service_zones_zone_city_fkey
    foreign key (service_zone_id, city_id)
    references public.service_zones (id, city_id)
    on update cascade
    on delete restrict,

  constraint branch_service_zones_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint branch_service_zones_updated_by_fkey
    foreign key (updated_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint branch_service_zones_branch_zone_key
    unique (branch_id, service_zone_id)
);

create unique index branch_service_zones_one_primary_idx
  on public.branch_service_zones (branch_id)
  where is_primary and is_active;

create index branch_service_zones_zone_active_idx
  on public.branch_service_zones (service_zone_id, branch_id)
  where is_active;

create table public.branch_postal_serviceability (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  pincode text not null,
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint branch_postal_serviceability_branch_id_fkey
    foreign key (branch_id)
    references public.merchant_branches (id)
    on update cascade
    on delete cascade,

  constraint branch_postal_serviceability_pincode_format
    check (pincode ~ '^[1-9][0-9]{5}$'),

  constraint branch_postal_serviceability_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint branch_postal_serviceability_updated_by_fkey
    foreign key (updated_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint branch_postal_serviceability_branch_pincode_key
    unique (branch_id, pincode)
);

create index branch_postal_serviceability_lookup_idx
  on public.branch_postal_serviceability (pincode, branch_id)
  where is_active;

create or replace function private.merchant_branch_transition_allowed(
  p_previous public.merchant_branch_status,
  p_next public.merchant_branch_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_previous = p_next
    or (p_previous = 'REGISTERED' and p_next in ('VERIFICATION_PENDING', 'SUSPENDED', 'CLOSED'))
    or (p_previous = 'VERIFICATION_PENDING' and p_next in ('REGISTERED', 'APPROVED', 'SUSPENDED', 'CLOSED'))
    or (p_previous = 'APPROVED' and p_next in ('ACTIVE', 'PAUSED', 'SUSPENDED', 'CLOSED'))
    or (p_previous = 'ACTIVE' and p_next in ('PAUSED', 'SUSPENDED', 'CLOSED'))
    or (p_previous = 'PAUSED' and p_next in ('ACTIVE', 'SUSPENDED', 'CLOSED'))
    or (p_previous = 'SUSPENDED' and p_next in ('APPROVED', 'CLOSED'));
$$;

create or replace function private.validate_merchant_branch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shop_row public.shops;
  merchant_row public.merchant_profiles;
  merchant_profile_row public.profiles;
  city_status public.market_lifecycle_status;
  zone_status public.market_lifecycle_status;
begin
  select *
  into strict shop_row
  from public.shops s
  where s.id = new.shop_id;

  if shop_row.merchant_id <> new.merchant_id then
    raise exception 'MERCHANT_BRANCH_SHOP_OWNER_MISMATCH'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.addresses a
    where a.id = new.address_id
      and a.user_id = new.merchant_id
  ) then
    raise exception 'MERCHANT_BRANCH_ADDRESS_OWNER_MISMATCH'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.addresses a
    where a.id = new.return_address_id
      and a.user_id = new.merchant_id
  ) then
    raise exception 'MERCHANT_BRANCH_RETURN_ADDRESS_OWNER_MISMATCH'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and new.status <> 'REGISTERED' then
    raise exception 'MERCHANT_BRANCH_MUST_START_REGISTERED'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and new.status is distinct from old.status
    and not private.merchant_branch_transition_allowed(old.status, new.status)
  then
    raise exception 'MERCHANT_BRANCH_STATUS_TRANSITION_INVALID'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and (
      new.city_id is distinct from old.city_id
      or new.primary_service_zone_id is distinct from old.primary_service_zone_id
      or new.address_id is distinct from old.address_id
      or new.location is distinct from old.location
      or new.pincode is distinct from old.pincode
    )
  then
    if old.status = 'ACTIVE' then
      raise exception 'MERCHANT_BRANCH_GEOGRAPHY_CHANGE_REQUIRES_PAUSE'
        using errcode = '23514';
    end if;
    new.geography_status := 'REVIEW_REQUIRED';
  end if;

  if new.branch_type = 'CLOUD_SHOP' then
    new.accepts_walk_in := false;
  end if;

  if new.verification_status = 'REJECTED'
    and new.status in ('APPROVED', 'ACTIVE', 'PAUSED')
  then
    raise exception 'MERCHANT_BRANCH_REJECTED_CANNOT_OPERATE'
      using errcode = '23514';
  end if;

  if new.status in ('APPROVED', 'ACTIVE', 'PAUSED')
    and new.verification_status <> 'VERIFIED'
  then
    raise exception 'MERCHANT_BRANCH_VERIFICATION_REQUIRED'
      using errcode = '23514';
  end if;

  if new.status = 'ACTIVE' then
    if new.geography_status <> 'VERIFIED' then
      raise exception 'MERCHANT_BRANCH_GEOGRAPHY_VERIFICATION_REQUIRED'
        using errcode = '23514';
    end if;

    select c.status
    into city_status
    from public.cities c
    where c.id = new.city_id;

    select sz.status
    into zone_status
    from public.service_zones sz
    where sz.id = new.primary_service_zone_id
      and sz.city_id = new.city_id;

    if city_status is distinct from 'ACTIVE'::public.market_lifecycle_status then
      raise exception 'MERCHANT_BRANCH_CITY_NOT_ACTIVE'
        using errcode = '23514';
    end if;

    if zone_status is distinct from 'ACTIVE'::public.market_lifecycle_status then
      raise exception 'MERCHANT_BRANCH_PRIMARY_ZONE_NOT_ACTIVE'
        using errcode = '23514';
    end if;

    if shop_row.deleted_at is not null
      or shop_row.verification_status <> 'VERIFIED'
      or shop_row.operational_status in ('PAUSED', 'SUSPENDED')
    then
      raise exception 'MERCHANT_BRANCH_SHOP_NOT_ELIGIBLE'
        using errcode = '23514';
    end if;

    select *
    into strict merchant_row
    from public.merchant_profiles mp
    where mp.user_id = new.merchant_id;

    select *
    into strict merchant_profile_row
    from public.profiles p
    where p.id = new.merchant_id;

    if merchant_profile_row.status <> 'ACTIVE'
      or merchant_row.kyc_status <> 'VERIFIED'
      or merchant_row.onboarding_status <> 'ACTIVE'
    then
      raise exception 'MERCHANT_BRANCH_MERCHANT_NOT_ELIGIBLE'
        using errcode = '23514';
    end if;

    if not new.local_delivery_enabled
      and not new.postal_delivery_enabled
    then
      raise exception 'MERCHANT_BRANCH_FULFILMENT_MODE_REQUIRED'
        using errcode = '23514';
    end if;

    if new.local_delivery_enabled
      and not exists (
        select 1
        from public.branch_service_zones bsz
        where bsz.branch_id = new.id
          and bsz.service_zone_id = new.primary_service_zone_id
          and bsz.is_active
      )
    then
      raise exception 'MERCHANT_BRANCH_LOCAL_ZONE_REQUIRED'
        using errcode = '23514';
    end if;

    if new.postal_delivery_enabled
      and not new.all_india_postal_enabled
      and not exists (
        select 1
        from public.branch_postal_serviceability bps
        where bps.branch_id = new.id
          and bps.is_active
      )
    then
      raise exception 'MERCHANT_BRANCH_POSTAL_COVERAGE_REQUIRED'
        using errcode = '23514';
    end if;

    if tg_op = 'INSERT'
      or old.status is distinct from 'ACTIVE'::public.merchant_branch_status
    then
      new.activated_at := now();
    end if;
  elsif new.status = 'PAUSED' then
    if tg_op = 'INSERT'
      or old.status is distinct from 'PAUSED'::public.merchant_branch_status
    then
      new.paused_at := now();
    end if;
  elsif new.status = 'SUSPENDED' then
    if tg_op = 'INSERT'
      or old.status is distinct from 'SUSPENDED'::public.merchant_branch_status
    then
      new.suspended_at := now();
    end if;
  elsif new.status = 'CLOSED' then
    if tg_op = 'INSERT'
      or old.status is distinct from 'CLOSED'::public.merchant_branch_status
    then
      new.closed_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger merchant_branches_validate
before insert or update on public.merchant_branches
for each row execute function private.validate_merchant_branch();

create trigger merchant_branches_set_updated_at
before update on public.merchant_branches
for each row execute function public.set_updated_at();

create trigger merchant_branch_hours_set_updated_at
before update on public.merchant_branch_hours
for each row execute function public.set_updated_at();

create trigger branch_service_zones_set_updated_at
before update on public.branch_service_zones
for each row execute function public.set_updated_at();

create trigger branch_postal_serviceability_set_updated_at
before update on public.branch_postal_serviceability
for each row execute function public.set_updated_at();

create or replace function private.ensure_legacy_unassigned_geography()
returns table (
  city_id uuid,
  service_zone_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cities (
    code,
    slug,
    name,
    state_code,
    country_code,
    status
  )
  values (
    'LEGACY_UNASSIGNED',
    'legacy-unassigned',
    'Legacy geography review queue',
    'NA',
    'IN',
    'DRAFT'
  )
  on conflict (code) do nothing;

  select c.id
  into city_id
  from public.cities c
  where c.code = 'LEGACY_UNASSIGNED';

  insert into public.service_zones (
    city_id,
    code,
    slug,
    name,
    status
  )
  values (
    city_id,
    'LEGACY_UNASSIGNED',
    'legacy-unassigned',
    'Legacy geography review queue',
    'DRAFT'
  )
  on conflict (city_id, code) do nothing;

  select sz.id
  into service_zone_id
  from public.service_zones sz
  where sz.city_id = city_id
    and sz.code = 'LEGACY_UNASSIGNED';

  return next;
end;
$$;

create or replace function private.create_legacy_branch_for_shop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  geography record;
  address_row public.addresses;
  branch_row public.merchant_branches;
begin
  if exists (
    select 1
    from public.merchant_branches mb
    where mb.shop_id = new.id
      and mb.is_primary
      and mb.status <> 'CLOSED'
  ) then
    return new;
  end if;

  select *
  into strict address_row
  from public.addresses a
  where a.id = new.address_id;

  select *
  into geography
  from private.ensure_legacy_unassigned_geography();

  insert into public.merchant_branches (
    shop_id,
    merchant_id,
    city_id,
    primary_service_zone_id,
    branch_code,
    name,
    branch_type,
    address_id,
    return_address_id,
    pincode,
    location,
    verification_status,
    geography_status,
    status,
    local_delivery_enabled,
    postal_delivery_enabled,
    all_india_postal_enabled,
    accepts_walk_in,
    average_preparation_minutes,
    is_primary,
    migration_source
  )
  values (
    new.id,
    new.merchant_id,
    geography.city_id,
    geography.service_zone_id,
    new.shop_code,
    new.name,
    'PHYSICAL_STORE',
    new.address_id,
    new.address_id,
    case
      when address_row.postal_code ~ '^[1-9][0-9]{5}$'
        then address_row.postal_code
      else null
    end,
    new.location,
    new.verification_status,
    'REVIEW_REQUIRED',
    'REGISTERED',
    false,
    false,
    false,
    true,
    new.average_preparation_minutes,
    true,
    'LEGACY_SHOP'
  )
  returning * into branch_row;

  insert into public.branch_service_zones (
    branch_id,
    city_id,
    service_zone_id,
    is_primary,
    is_active
  )
  values (
    branch_row.id,
    branch_row.city_id,
    branch_row.primary_service_zone_id,
    true,
    false
  );

  insert into public.merchant_branch_hours (
    branch_id,
    schedule_type,
    day_of_week,
    special_date,
    open_time,
    close_time,
    is_closed
  )
  select
    branch_row.id,
    sh.schedule_type,
    sh.day_of_week,
    sh.special_date,
    sh.open_time,
    sh.close_time,
    sh.is_closed
  from public.shop_hours sh
  where sh.shop_id = new.id
  on conflict do nothing;

  return new;
end;
$$;

create trigger shops_create_legacy_primary_branch
after insert on public.shops
for each row execute function private.create_legacy_branch_for_shop();

-- The trigger helper expects NEW, so backfill existing shops explicitly.
do $$
declare
  geography record;
  shop_row public.shops;
  address_row public.addresses;
  branch_row public.merchant_branches;
begin
  select *
  into geography
  from private.ensure_legacy_unassigned_geography();

  for shop_row in
    select *
    from public.shops s
    where not exists (
      select 1
      from public.merchant_branches mb
      where mb.shop_id = s.id
        and mb.is_primary
        and mb.status <> 'CLOSED'
    )
    order by s.created_at, s.id
  loop
    select *
    into strict address_row
    from public.addresses a
    where a.id = shop_row.address_id;

    insert into public.merchant_branches (
      shop_id,
      merchant_id,
      city_id,
      primary_service_zone_id,
      branch_code,
      name,
      branch_type,
      address_id,
      return_address_id,
      pincode,
      location,
      verification_status,
      geography_status,
      status,
      local_delivery_enabled,
      postal_delivery_enabled,
      all_india_postal_enabled,
      accepts_walk_in,
      average_preparation_minutes,
      is_primary,
      migration_source
    )
    values (
      shop_row.id,
      shop_row.merchant_id,
      geography.city_id,
      geography.service_zone_id,
      shop_row.shop_code,
      shop_row.name,
      'PHYSICAL_STORE',
      shop_row.address_id,
      shop_row.address_id,
      case
        when address_row.postal_code ~ '^[1-9][0-9]{5}$'
          then address_row.postal_code
        else null
      end,
      shop_row.location,
      shop_row.verification_status,
      'REVIEW_REQUIRED',
      'REGISTERED',
      false,
      false,
      false,
      true,
      shop_row.average_preparation_minutes,
      true,
      'LEGACY_SHOP'
    )
    returning * into branch_row;

    insert into public.branch_service_zones (
      branch_id,
      city_id,
      service_zone_id,
      is_primary,
      is_active
    )
    values (
      branch_row.id,
      branch_row.city_id,
      branch_row.primary_service_zone_id,
      true,
      false
    );

    insert into public.merchant_branch_hours (
      branch_id,
      schedule_type,
      day_of_week,
      special_date,
      open_time,
      close_time,
      is_closed
    )
    select
      branch_row.id,
      sh.schedule_type,
      sh.day_of_week,
      sh.special_date,
      sh.open_time,
      sh.close_time,
      sh.is_closed
    from public.shop_hours sh
    where sh.shop_id = shop_row.id
    on conflict do nothing;
  end loop;
end;
$$;


create or replace function private.sync_legacy_shop_hour_to_branch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shop_id uuid;
  branch_id uuid;
begin
  target_shop_id := case
    when tg_op = 'DELETE' then old.shop_id
    else new.shop_id
  end;

  select mb.id
  into branch_id
  from public.merchant_branches mb
  where mb.shop_id = target_shop_id
    and mb.is_primary
    and mb.migration_source = 'LEGACY_SHOP'
    and mb.status <> 'CLOSED'
  order by mb.created_at, mb.id
  limit 1;

  if branch_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.merchant_branch_hours mbh
    where mbh.branch_id = branch_id
      and mbh.schedule_type = old.schedule_type
      and mbh.day_of_week is not distinct from old.day_of_week
      and mbh.special_date is not distinct from old.special_date;
  end if;

  if tg_op <> 'DELETE' then
    insert into public.merchant_branch_hours (
      branch_id,
      schedule_type,
      day_of_week,
      special_date,
      open_time,
      close_time,
      is_closed
    )
    values (
      branch_id,
      new.schedule_type,
      new.day_of_week,
      new.special_date,
      new.open_time,
      new.close_time,
      new.is_closed
    )
    on conflict do nothing;

    update public.merchant_branch_hours mbh
    set
      open_time = new.open_time,
      close_time = new.close_time,
      is_closed = new.is_closed
    where mbh.branch_id = branch_id
      and mbh.schedule_type = new.schedule_type
      and mbh.day_of_week is not distinct from new.day_of_week
      and mbh.special_date is not distinct from new.special_date;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger shop_hours_sync_legacy_branch_hours
after insert or update or delete on public.shop_hours
for each row execute function private.sync_legacy_shop_hour_to_branch();

create or replace function private.suspend_branches_for_merchant_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.onboarding_status = 'SUSPENDED'
    and new.onboarding_status is distinct from old.onboarding_status
  then
    update public.merchant_branches
    set status = 'SUSPENDED'
    where merchant_id = new.user_id
      and status <> 'CLOSED';
  elsif new.onboarding_status in ('PAUSED', 'REJECTED')
    and new.onboarding_status is distinct from old.onboarding_status
  then
    update public.merchant_branches
    set status = case
      when status = 'ACTIVE' then 'PAUSED'::public.merchant_branch_status
      else status
    end
    where merchant_id = new.user_id
      and status <> 'CLOSED';
  end if;

  return new;
end;
$$;

create trigger merchant_profiles_sync_branch_suspension
after update of onboarding_status on public.merchant_profiles
for each row execute function private.suspend_branches_for_merchant_profile();

create or replace function private.suspend_branches_for_profile_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_type = 'MERCHANT'
    and new.status in ('BLOCKED', 'SUSPENDED', 'DELETED')
    and new.status is distinct from old.status
  then
    update public.merchant_branches
    set status = 'SUSPENDED'
    where merchant_id = new.id
      and status <> 'CLOSED';
  end if;

  return new;
end;
$$;

create trigger profiles_sync_branch_suspension
after update of status on public.profiles
for each row execute function private.suspend_branches_for_profile_status();

create or replace function private.suspend_branches_for_shop_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.operational_status = 'SUSPENDED'
    and new.operational_status is distinct from old.operational_status
  then
    update public.merchant_branches
    set status = 'SUSPENDED'
    where shop_id = new.id
      and status <> 'CLOSED';
  elsif new.operational_status = 'PAUSED'
    and new.operational_status is distinct from old.operational_status
  then
    update public.merchant_branches
    set status = 'PAUSED'
    where shop_id = new.id
      and status = 'ACTIVE';
  end if;

  return new;
end;
$$;

create trigger shops_sync_branch_suspension
after update of operational_status on public.shops
for each row execute function private.suspend_branches_for_shop_status();

create or replace function authz.owns_merchant_branch(
  p_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchant_branches mb
    where mb.id = p_branch_id
      and mb.merchant_id = auth.uid()
  );
$$;

create or replace function authz.can_manage_merchant_branch(
  p_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchant_branches mb
    where mb.id = p_branch_id
      and (
        authz.is_global_admin()
        or authz.has_city_role(
          mb.city_id,
          'CITY_ADMIN'::public.city_admin_role
        )
        or authz.has_city_role(
          mb.city_id,
          'CITY_OPERATIONS'::public.city_admin_role
        )
        or authz.has_city_role(
          mb.city_id,
          'MERCHANT_REVIEWER'::public.city_admin_role
        )
      )
  );
$$;

create or replace function authz.can_read_merchant_branch(
  p_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.owns_merchant_branch(p_branch_id)
    or authz.can_manage_merchant_branch(p_branch_id);
$$;

revoke all
on function private.merchant_branch_transition_allowed(
  public.merchant_branch_status,
  public.merchant_branch_status
)
from public, anon, authenticated;

revoke all
on function private.validate_merchant_branch()
from public, anon, authenticated;

revoke all
on function private.ensure_legacy_unassigned_geography()
from public, anon, authenticated;

revoke all
on function private.create_legacy_branch_for_shop()
from public, anon, authenticated;

revoke all
on function private.sync_legacy_shop_hour_to_branch()
from public, anon, authenticated;

revoke all
on function private.suspend_branches_for_merchant_profile()
from public, anon, authenticated;

revoke all
on function private.suspend_branches_for_profile_status()
from public, anon, authenticated;

revoke all
on function private.suspend_branches_for_shop_status()
from public, anon, authenticated;

revoke all
on function authz.owns_merchant_branch(uuid)
from public;

revoke all
on function authz.can_manage_merchant_branch(uuid)
from public;

revoke all
on function authz.can_read_merchant_branch(uuid)
from public;

grant execute
on function authz.owns_merchant_branch(uuid)
to authenticated, service_role;

grant execute
on function authz.can_manage_merchant_branch(uuid)
to authenticated, service_role;

grant execute
on function authz.can_read_merchant_branch(uuid)
to authenticated, service_role;

alter table public.merchant_branches enable row level security;
alter table public.merchant_branches force row level security;

alter table public.merchant_branch_hours enable row level security;
alter table public.merchant_branch_hours force row level security;

alter table public.branch_service_zones enable row level security;
alter table public.branch_service_zones force row level security;

alter table public.branch_postal_serviceability enable row level security;
alter table public.branch_postal_serviceability force row level security;

revoke all privileges
on table
  public.merchant_branches,
  public.merchant_branch_hours,
  public.branch_service_zones,
  public.branch_postal_serviceability
from anon, authenticated;

grant select
on table
  public.merchant_branches,
  public.merchant_branch_hours,
  public.branch_service_zones,
  public.branch_postal_serviceability
to authenticated;

grant all privileges
on table
  public.merchant_branches,
  public.merchant_branch_hours,
  public.branch_service_zones,
  public.branch_postal_serviceability
to service_role;

create policy merchant_branches_owner_or_admin_read
on public.merchant_branches
for select
to authenticated
using (authz.can_read_merchant_branch(id));

create policy merchant_branch_hours_owner_or_admin_read
on public.merchant_branch_hours
for select
to authenticated
using (authz.can_read_merchant_branch(branch_id));

create policy branch_service_zones_owner_or_admin_read
on public.branch_service_zones
for select
to authenticated
using (authz.can_read_merchant_branch(branch_id));

create policy branch_postal_serviceability_owner_or_admin_read
on public.branch_postal_serviceability
for select
to authenticated
using (authz.can_read_merchant_branch(branch_id));
