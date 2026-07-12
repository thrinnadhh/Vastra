-- Vastra authorization predicates and trusted outbox worker functions.
--
-- Authorization predicates live outside the API-exposed public schema.
-- They are SECURITY DEFINER functions with fixed empty search paths.
--
-- Sensitive workflow functions remain in private and executable only by
-- trusted service-role processes.

create schema if not exists authz;

revoke all on schema authz from public;
grant usage on schema authz to anon, authenticated, service_role;

create or replace function authz.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.account_type::text = 'ADMIN'
        and p.status::text = 'ACTIVE'
    )
    or exists (
      select 1
      from public.admin_profiles ap
      where ap.user_id = auth.uid()
    );
$$;

create or replace function authz.has_role(
  p_role_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.revoked_at is null
      and r.code = p_role_code
  );
$$;

create or replace function authz.has_permission(
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.is_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp
        on rp.role_id = ur.role_id
      join public.permissions p
        on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and ur.revoked_at is null
        and p.code = p_permission_code
    );
$$;

create or replace function authz.owns_shop(
  p_shop_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shops s
    where s.id = p_shop_id
      and s.merchant_id = auth.uid()
  );
$$;

create or replace function authz.owns_product(
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and authz.owns_shop(p.shop_id)
  );
$$;

create or replace function authz.owns_variant(
  p_variant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.product_variants pv
    where pv.id = p_variant_id
      and authz.owns_shop(pv.shop_id)
  );
$$;

create or replace function authz.is_public_shop(
  p_shop_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shops s
    where s.id = p_shop_id
      and s.deleted_at is null
      and s.verification_status::text = 'VERIFIED'
      and s.operational_status::text not in (
        'PAUSED',
        'SUSPENDED'
      )
  );
$$;

create or replace function authz.is_public_product(
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.deleted_at is null
      and p.is_active
      and p.moderation_status::text = 'APPROVED'
      and authz.is_public_shop(p.shop_id)
  );
$$;

create or replace function authz.can_access_order(
  p_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.is_admin()
    or exists (
      select 1
      from public.orders o
      where o.id = p_order_id
        and (
          o.customer_id = auth.uid()
          or authz.owns_shop(o.shop_id)
        )
    )
    or exists (
      select 1
      from public.delivery_tasks dt
      where dt.order_id = p_order_id
        and dt.assigned_captain_id = auth.uid()
    );
$$;

create or replace function authz.can_access_return(
  p_return_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.is_admin()
    or exists (
      select 1
      from public.return_requests rr
      where rr.id = p_return_request_id
        and (
          rr.customer_id = auth.uid()
          or authz.owns_shop(rr.shop_id)
        )
    );
$$;

create or replace function authz.can_access_delivery_task(
  p_delivery_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.is_admin()
    or exists (
      select 1
      from public.delivery_tasks dt
      where dt.id = p_delivery_task_id
        and (
          dt.assigned_captain_id = auth.uid()
          or authz.owns_shop(dt.pickup_shop_id)
          or (
            dt.order_id is not null
            and exists (
              select 1
              from public.orders o
              where o.id = dt.order_id
                and o.customer_id = auth.uid()
            )
          )
        )
    );
$$;

create or replace function authz.can_access_support_ticket(
  p_ticket_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    authz.is_admin()
    or exists (
      select 1
      from public.support_tickets st
      where st.id = p_ticket_id
        and (
          st.raised_by_user_id = auth.uid()
          or st.assigned_to = auth.uid()
        )
    );
$$;

revoke all on all functions in schema authz from public;

grant execute on all functions in schema authz
to authenticated, service_role;

grant execute
on function authz.is_public_shop(uuid)
to anon;

grant execute
on function authz.is_public_product(uuid)
to anon;

create or replace function private.claim_outbox_events(
  p_worker_id text,
  p_batch_size integer default 50
)
returns setof public.outbox_events
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null
    or length(btrim(p_worker_id)) = 0
  then
    raise exception
      'worker ID is required'
      using errcode = '22023';
  end if;

  if p_batch_size < 1
    or p_batch_size > 500
  then
    raise exception
      'batch size must be between 1 and 500'
      using errcode = '22023';
  end if;

  return query
  with candidates as (
    select oe.id
    from public.outbox_events oe
    where oe.status in ('PENDING', 'FAILED')
      and oe.available_at <= now()
      and oe.attempt_count < oe.max_attempts
    order by
      oe.available_at,
      oe.created_at,
      oe.id
    for update skip locked
    limit p_batch_size
  )
  update public.outbox_events oe
  set
    status = 'PROCESSING',
    attempt_count = oe.attempt_count + 1,
    locked_at = now(),
    locked_by = p_worker_id,
    failed_at = null,
    last_error = null
  from candidates c
  where oe.id = c.id
  returning oe.*;
end;
$$;

create or replace function private.complete_outbox_event(
  p_event_id uuid,
  p_worker_id text
)
returns public.outbox_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.outbox_events;
begin
  update public.outbox_events oe
  set
    status = 'PUBLISHED',
    published_at = now(),
    locked_at = null,
    locked_by = null,
    failed_at = null,
    last_error = null
  where oe.id = p_event_id
    and oe.status = 'PROCESSING'
    and oe.locked_by = p_worker_id
  returning * into event_row;

  if event_row.id is null then
    raise exception
      'outbox event is not locked by this worker'
      using errcode = '23514';
  end if;

  return event_row;
end;
$$;

create or replace function private.fail_outbox_event(
  p_event_id uuid,
  p_worker_id text,
  p_error text,
  p_retry_at timestamptz default now()
)
returns public.outbox_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.outbox_events;
begin
  if p_error is null
    or length(btrim(p_error)) = 0
  then
    raise exception
      'failure message is required'
      using errcode = '22023';
  end if;

  update public.outbox_events oe
  set
    status = case
      when oe.attempt_count >= oe.max_attempts
        then 'DEAD_LETTER'::public.outbox_event_status
      else 'FAILED'::public.outbox_event_status
    end,
    available_at = greatest(
      p_retry_at,
      oe.occurred_at
    ),
    locked_at = null,
    locked_by = null,
    failed_at = now(),
    last_error = p_error
  where oe.id = p_event_id
    and oe.status = 'PROCESSING'
    and oe.locked_by = p_worker_id
  returning * into event_row;

  if event_row.id is null then
    raise exception
      'outbox event is not locked by this worker'
      using errcode = '23514';
  end if;

  return event_row;
end;
$$;

revoke all
on function private.claim_outbox_events(text, integer)
from public, anon, authenticated;

revoke all
on function private.complete_outbox_event(uuid, text)
from public, anon, authenticated;

revoke all
on function private.fail_outbox_event(
  uuid,
  text,
  text,
  timestamptz
)
from public, anon, authenticated;

grant execute
on function private.claim_outbox_events(text, integer)
to service_role;

grant execute
on function private.complete_outbox_event(uuid, text)
to service_role;

grant execute
on function private.fail_outbox_event(
  uuid,
  text,
  text,
  timestamptz
)
to service_role;
