-- Vastra Phase 2A multi-city geographic core.
--
-- Implements the commercial launch contract's configurable city, zone, pincode,
-- city-configuration, and scoped-administration foundation.
--
-- No city is activated by this migration. Production activation remains a
-- separately audited workflow with staging and operational preflight evidence.

create type public.market_lifecycle_status as enum (
  'DRAFT',
  'CONFIGURING',
  'READY_FOR_VALIDATION',
  'ACTIVE',
  'PAUSED',
  'CLOSED'
);

create type public.city_admin_role as enum (
  'CITY_ADMIN',
  'CITY_OPERATIONS',
  'MERCHANT_REVIEWER',
  'CAPTAIN_OPERATIONS',
  'SUPPORT_AGENT',
  'FINANCE_AGENT'
);

alter table public.admin_profiles
add column has_global_access boolean not null default false;

-- Existing administrator profiles previously had platform-wide access through
-- authz.is_admin(). Preserve that behavior during the migration; newly created
-- admin profiles default to scoped access.
update public.admin_profiles
set has_global_access = true;

comment on column public.admin_profiles.has_global_access is
  'Explicit platform-wide administrative scope. New administrators default to city-scoped access.';

comment on column public.admin_profiles.city_scope is
  'Deprecated free-form city scope retained for compatibility. Use admin_city_assignments.';

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  slug text not null,
  name text not null,
  state_code text not null,
  country_code text not null default 'IN',
  status public.market_lifecycle_status not null default 'DRAFT',
  activated_at timestamptz,
  paused_at timestamptz,
  closed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cities_code_key unique (code),
  constraint cities_slug_key unique (slug),

  constraint cities_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint cities_updated_by_fkey
    foreign key (updated_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint cities_code_format
    check (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),

  constraint cities_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint cities_name_nonempty
    check (length(btrim(name)) > 0),

  constraint cities_state_code_format
    check (state_code ~ '^[A-Z]{2}$'),

  constraint cities_country_code_format
    check (country_code ~ '^[A-Z]{2}$'),

  constraint cities_activated_after_creation
    check (activated_at is null or activated_at >= created_at),

  constraint cities_paused_after_creation
    check (paused_at is null or paused_at >= created_at),

  constraint cities_closed_after_creation
    check (closed_at is null or closed_at >= created_at)
);

comment on table public.cities is
  'Commercial city markets. Lifecycle changes are configuration, not deployments.';

create table public.city_configurations (
  city_id uuid primary key,
  timezone text not null default 'Asia/Kolkata',
  default_cod_limit_paise public.money_paise not null default 200000,
  default_delivery_radius_meters integer not null default 5000,
  maximum_delivery_radius_meters integer not null default 15000,
  base_delivery_fee_paise public.money_paise not null default 0,
  per_km_delivery_fee_paise public.money_paise not null default 0,
  merchant_commission_bps integer not null default 0,
  local_delivery_enabled boolean not null default true,
  postal_delivery_enabled boolean not null default false,
  operating_hours jsonb not null default '{}'::jsonb,
  holiday_dates date[] not null default '{}'::date[],
  cancellation_policy jsonb not null default '{}'::jsonb,
  refund_policy jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint city_configurations_city_id_fkey
    foreign key (city_id)
    references public.cities (id)
    on update cascade
    on delete restrict,

  constraint city_configurations_updated_by_fkey
    foreign key (updated_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint city_configurations_timezone_nonempty
    check (length(btrim(timezone)) > 0),

  constraint city_configurations_default_radius_positive
    check (default_delivery_radius_meters > 0),

  constraint city_configurations_maximum_radius_valid
    check (
      maximum_delivery_radius_meters > 0
      and maximum_delivery_radius_meters >= default_delivery_radius_meters
    ),

  constraint city_configurations_commission_range
    check (merchant_commission_bps between 0 and 10000),

  constraint city_configurations_operating_hours_object
    check (jsonb_typeof(operating_hours) = 'object'),

  constraint city_configurations_cancellation_policy_object
    check (jsonb_typeof(cancellation_policy) = 'object'),

  constraint city_configurations_refund_policy_object
    check (jsonb_typeof(refund_policy) = 'object'),

  constraint city_configurations_version_positive
    check (version > 0)
);

comment on table public.city_configurations is
  'Versioned commercial defaults for one city; effective values are snapshotted on future orders.';

create table public.service_zones (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null,
  code text not null,
  slug text not null,
  name text not null,
  status public.market_lifecycle_status not null default 'DRAFT',
  boundary extensions.geometry(MultiPolygon, 4326),
  center_point extensions.geography(Point, 4326),
  default_delivery_radius_meters integer,
  activated_at timestamptz,
  paused_at timestamptz,
  closed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_zones_city_id_fkey
    foreign key (city_id)
    references public.cities (id)
    on update cascade
    on delete restrict,

  constraint service_zones_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint service_zones_updated_by_fkey
    foreign key (updated_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint service_zones_city_code_key unique (city_id, code),
  constraint service_zones_city_slug_key unique (city_id, slug),
  constraint service_zones_id_city_key unique (id, city_id),

  constraint service_zones_code_format
    check (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),

  constraint service_zones_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint service_zones_name_nonempty
    check (length(btrim(name)) > 0),

  constraint service_zones_radius_positive
    check (
      default_delivery_radius_meters is null
      or default_delivery_radius_meters > 0
    ),

  constraint service_zones_boundary_valid
    check (
      boundary is null
      or extensions.st_isvalid(boundary)
    ),

  constraint service_zones_activated_after_creation
    check (activated_at is null or activated_at >= created_at),

  constraint service_zones_paused_after_creation
    check (paused_at is null or paused_at >= created_at),

  constraint service_zones_closed_after_creation
    check (closed_at is null or closed_at >= created_at)
);

comment on table public.service_zones is
  'Independently controlled local-delivery zones inside a city, with optional geofence geometry.';

create index service_zones_city_status_idx
  on public.service_zones (city_id, status);

create index service_zones_boundary_gist_idx
  on public.service_zones
  using gist (boundary)
  where boundary is not null;

create index service_zones_center_point_gist_idx
  on public.service_zones
  using gist (center_point)
  where center_point is not null;

create table public.service_zone_pincodes (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null,
  service_zone_id uuid not null,
  pincode text not null,
  priority smallint not null default 100,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_zone_pincodes_city_id_fkey
    foreign key (city_id)
    references public.cities (id)
    on update cascade
    on delete restrict,

  constraint service_zone_pincodes_zone_city_fkey
    foreign key (service_zone_id, city_id)
    references public.service_zones (id, city_id)
    on update cascade
    on delete restrict,

  constraint service_zone_pincodes_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint service_zone_pincodes_updated_by_fkey
    foreign key (updated_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint service_zone_pincodes_zone_pincode_key
    unique (service_zone_id, pincode),

  constraint service_zone_pincodes_india_format
    check (pincode ~ '^[1-9][0-9]{5}$'),

  constraint service_zone_pincodes_priority_range
    check (priority between 1 and 1000)
);

comment on table public.service_zone_pincodes is
  'Pincode-to-zone routing. Duplicate pincode coverage requires explicit, unique priority.';

create unique index service_zone_pincodes_active_priority_key
  on public.service_zone_pincodes (city_id, pincode, priority)
  where is_active;

create unique index service_zone_pincodes_active_primary_key
  on public.service_zone_pincodes (city_id, pincode)
  where is_active and is_primary;

create index service_zone_pincodes_lookup_idx
  on public.service_zone_pincodes (pincode, city_id, priority)
  where is_active;

create table public.admin_city_assignments (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  city_id uuid not null,
  service_zone_id uuid,
  role public.city_admin_role not null,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),

  constraint admin_city_assignments_admin_user_id_fkey
    foreign key (admin_user_id)
    references public.admin_profiles (user_id)
    on update cascade
    on delete cascade,

  constraint admin_city_assignments_city_id_fkey
    foreign key (city_id)
    references public.cities (id)
    on update cascade
    on delete restrict,

  constraint admin_city_assignments_zone_city_fkey
    foreign key (service_zone_id, city_id)
    references public.service_zones (id, city_id)
    on update cascade
    on delete restrict,

  constraint admin_city_assignments_assigned_by_fkey
    foreign key (assigned_by)
    references public.admin_profiles (user_id)
    on update cascade
    on delete set null,

  constraint admin_city_assignments_revoked_by_fkey
    foreign key (revoked_by)
    references public.admin_profiles (user_id)
    on update cascade
    on delete set null,

  constraint admin_city_assignments_revocation_consistency
    check (
      (revoked_at is null and revoked_by is null)
      or (
        revoked_at is not null
        and revoked_at >= assigned_at
      )
    ),

  constraint admin_city_assignments_reason_nonempty
    check (reason is null or length(btrim(reason)) > 0)
);

comment on table public.admin_city_assignments is
  'Auditable city- or zone-scoped administrative responsibility. Revoke rows instead of deleting them.';

create unique index admin_city_assignments_active_unique_idx
  on public.admin_city_assignments (
    admin_user_id,
    city_id,
    role,
    coalesce(
      service_zone_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  )
  where revoked_at is null;

create index admin_city_assignments_admin_active_idx
  on public.admin_city_assignments (admin_user_id, city_id)
  where revoked_at is null;

create index admin_city_assignments_city_active_idx
  on public.admin_city_assignments (city_id, role)
  where revoked_at is null;

create or replace function private.create_default_city_configuration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.city_configurations (
    city_id,
    updated_by
  )
  values (
    new.id,
    new.created_by
  );

  return new;
end;
$$;

revoke all
on function private.create_default_city_configuration()
from public, anon, authenticated;

create trigger cities_create_default_configuration
after insert on public.cities
for each row execute function private.create_default_city_configuration();

create or replace function private.market_transition_allowed(
  p_previous public.market_lifecycle_status,
  p_next public.market_lifecycle_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_previous = p_next
    or (
      p_previous = 'DRAFT'
      and p_next in ('CONFIGURING', 'CLOSED')
    )
    or (
      p_previous = 'CONFIGURING'
      and p_next in ('DRAFT', 'READY_FOR_VALIDATION', 'CLOSED')
    )
    or (
      p_previous = 'READY_FOR_VALIDATION'
      and p_next in ('CONFIGURING', 'ACTIVE', 'CLOSED')
    )
    or (
      p_previous = 'ACTIVE'
      and p_next in ('PAUSED', 'CLOSED')
    )
    or (
      p_previous = 'PAUSED'
      and p_next in ('CONFIGURING', 'ACTIVE', 'CLOSED')
    );
$$;

create or replace function private.enforce_market_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' then
      raise exception 'MARKET_INITIAL_STATUS_INVALID'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if not private.market_transition_allowed(old.status, new.status) then
    raise exception 'MARKET_LIFECYCLE_TRANSITION_INVALID'
      using errcode = '23514';
  end if;

  if new.status = 'ACTIVE' then
    new.activated_at = coalesce(new.activated_at, now());
    new.paused_at = null;
  elsif new.status = 'PAUSED' then
    new.paused_at = now();
  elsif new.status = 'CLOSED' then
    new.closed_at = now();
  end if;

  return new;
end;
$$;

create or replace function private.enforce_service_zone_parent_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_status public.market_lifecycle_status;
begin
  if new.status <> 'ACTIVE' then
    return new;
  end if;

  select c.status
  into parent_status
  from public.cities c
  where c.id = new.city_id;

  if parent_status is distinct from 'ACTIVE'::public.market_lifecycle_status then
    raise exception 'SERVICE_ZONE_PARENT_CITY_NOT_ACTIVE'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all
on function private.market_transition_allowed(
  public.market_lifecycle_status,
  public.market_lifecycle_status
)
from public, anon, authenticated;

revoke all
on function private.enforce_market_lifecycle()
from public, anon, authenticated;

revoke all
on function private.enforce_service_zone_parent_state()
from public, anon, authenticated;

create trigger cities_enforce_lifecycle
before insert or update of status
on public.cities
for each row execute function private.enforce_market_lifecycle();

create trigger service_zones_enforce_lifecycle
before insert or update of status
on public.service_zones
for each row execute function private.enforce_market_lifecycle();

create trigger service_zones_enforce_parent_state
before insert or update
on public.service_zones
for each row execute function private.enforce_service_zone_parent_state();

create trigger cities_set_updated_at
before update on public.cities
for each row execute function public.set_updated_at();

create trigger city_configurations_set_updated_at
before update on public.city_configurations
for each row execute function public.set_updated_at();

create trigger service_zones_set_updated_at
before update on public.service_zones
for each row execute function public.set_updated_at();

create trigger service_zone_pincodes_set_updated_at
before update on public.service_zone_pincodes
for each row execute function public.set_updated_at();

create or replace function authz.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.has_aal2()
    and exists (
      select 1
      from public.profiles p
      join public.admin_profiles ap
        on ap.user_id = p.id
      where p.id = auth.uid()
        and p.status::text = 'ACTIVE'
        and ap.has_global_access
    );
$$;

create or replace function authz.has_city_access(
  p_city_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.is_global_admin()
    or (
      authz.has_aal2()
      and exists (
        select 1
        from public.profiles p
        join public.admin_profiles ap
          on ap.user_id = p.id
        join public.admin_city_assignments aca
          on aca.admin_user_id = ap.user_id
        where p.id = auth.uid()
          and p.status::text = 'ACTIVE'
          and aca.city_id = p_city_id
          and aca.revoked_at is null
      )
    );
$$;

create or replace function authz.has_city_role(
  p_city_id uuid,
  p_role public.city_admin_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.is_global_admin()
    or (
      authz.has_aal2()
      and exists (
        select 1
        from public.profiles p
        join public.admin_profiles ap
          on ap.user_id = p.id
        join public.admin_city_assignments aca
          on aca.admin_user_id = ap.user_id
        where p.id = auth.uid()
          and p.status::text = 'ACTIVE'
          and aca.city_id = p_city_id
          and aca.role = p_role
          and aca.revoked_at is null
      )
    );
$$;

create or replace function authz.can_manage_city(
  p_city_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select authz.has_city_role(
    p_city_id,
    'CITY_ADMIN'::public.city_admin_role
  );
$$;

create or replace function authz.can_read_service_zone(
  p_service_zone_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_zones sz
    where sz.id = p_service_zone_id
      and authz.has_city_access(sz.city_id)
  );
$$;

revoke all
on function authz.is_global_admin()
from public;

revoke all
on function authz.has_city_access(uuid)
from public;

revoke all
on function authz.has_city_role(
  uuid,
  public.city_admin_role
)
from public;

revoke all
on function authz.can_manage_city(uuid)
from public;

revoke all
on function authz.can_read_service_zone(uuid)
from public;

grant execute
on function authz.is_global_admin()
to authenticated, service_role;

grant execute
on function authz.has_city_access(uuid)
to authenticated, service_role;

grant execute
on function authz.has_city_role(
  uuid,
  public.city_admin_role
)
to authenticated, service_role;

grant execute
on function authz.can_manage_city(uuid)
to authenticated, service_role;

grant execute
on function authz.can_read_service_zone(uuid)
to authenticated, service_role;

alter table public.cities enable row level security;
alter table public.cities force row level security;

alter table public.city_configurations enable row level security;
alter table public.city_configurations force row level security;

alter table public.service_zones enable row level security;
alter table public.service_zones force row level security;

alter table public.service_zone_pincodes enable row level security;
alter table public.service_zone_pincodes force row level security;

alter table public.admin_city_assignments enable row level security;
alter table public.admin_city_assignments force row level security;

revoke all privileges
on table
  public.cities,
  public.city_configurations,
  public.service_zones,
  public.service_zone_pincodes,
  public.admin_city_assignments
from anon, authenticated;

grant select
on table
  public.cities,
  public.service_zones,
  public.service_zone_pincodes
to anon, authenticated;

grant select
on table
  public.city_configurations,
  public.admin_city_assignments
to authenticated;

grant all privileges
on table
  public.cities,
  public.city_configurations,
  public.service_zones,
  public.service_zone_pincodes,
  public.admin_city_assignments
to service_role;

create policy cities_public_active_read
on public.cities
for select
to anon, authenticated
using (status = 'ACTIVE');

create policy cities_admin_scoped_read
on public.cities
for select
to authenticated
using (authz.has_city_access(id));

create policy city_configurations_admin_scoped_read
on public.city_configurations
for select
to authenticated
using (authz.has_city_access(city_id));

create policy service_zones_public_active_read
on public.service_zones
for select
to anon, authenticated
using (
  status = 'ACTIVE'
  and exists (
    select 1
    from public.cities c
    where c.id = public.service_zones.city_id
      and c.status = 'ACTIVE'
  )
);

create policy service_zones_admin_scoped_read
on public.service_zones
for select
to authenticated
using (authz.has_city_access(city_id));

create policy service_zone_pincodes_public_active_read
on public.service_zone_pincodes
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.cities c
    join public.service_zones sz
      on sz.city_id = c.id
    where c.id = public.service_zone_pincodes.city_id
      and sz.id = public.service_zone_pincodes.service_zone_id
      and c.status = 'ACTIVE'
      and sz.status = 'ACTIVE'
  )
);

create policy service_zone_pincodes_admin_scoped_read
on public.service_zone_pincodes
for select
to authenticated
using (authz.has_city_access(city_id));

create policy admin_city_assignments_self_read
on public.admin_city_assignments
for select
to authenticated
using (admin_user_id = (select auth.uid()));

create policy admin_city_assignments_global_read
on public.admin_city_assignments
for select
to authenticated
using (authz.is_global_admin());

create policy admin_city_assignments_city_admin_read
on public.admin_city_assignments
for select
to authenticated
using (
  authz.has_city_role(
    city_id,
    'CITY_ADMIN'::public.city_admin_role
  )
);
