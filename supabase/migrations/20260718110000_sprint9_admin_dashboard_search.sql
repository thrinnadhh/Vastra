create or replace function public.get_admin_operations_dashboard()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'open_orders', (
      select count(*)::integer from public.orders
      where status not in ('COMPLETED','CANCELLED')
    ),
    'intervention_orders', (
      select count(*)::integer from public.orders
      where status = 'PROBLEM_REPORTED'
         or (status = 'WAITING_FOR_MERCHANT'
           and updated_at < now() - interval '5 minutes')
         or (status = 'CAPTAIN_SEARCHING'
           and updated_at < now() - interval '10 minutes')
    ),
    'searching_deliveries', (
      select count(*)::integer from public.delivery_tasks
      where status in ('SEARCHING','OFFERED')
    ),
    'active_deliveries', (
      select count(*)::integer from public.delivery_tasks
      where status in ('ASSIGNED','AT_PICKUP','PICKED_UP','IN_TRANSIT','AT_DROP')
    ),
    'open_cases', (
      select count(*)::integer from public.support_tickets
      where status not in ('RESOLVED','CLOSED')
    ),
    'suspended_merchants', (
      select count(*)::integer
      from public.merchant_profiles m
      join public.profiles p on p.id = m.user_id
      where m.onboarding_status = 'SUSPENDED' or p.status = 'SUSPENDED'
    ),
    'suspended_captains', (
      select count(*)::integer
      from public.captain_profiles c
      join public.profiles p on p.id = c.user_id
      where c.availability_status = 'SUSPENDED' or p.status = 'SUSPENDED'
    ),
    'generated_at', now()
  )
$$;

create or replace function public.search_admin_operations(
  p_query text,
  p_limit integer default 20
) returns setof jsonb
language sql
security definer
set search_path = public
stable
as $$
  with normalized as (
    select
      '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' as pattern,
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit
  ), results as (
    select
      'ORDER'::text as result_type,
      o.id as resource_id,
      o.order_number as primary_text,
      'Order ' || o.fulfilment_type::text as secondary_text,
      o.status::text as status,
      o.updated_at
    from public.orders o
    join public.profiles customer on customer.id = o.customer_id
    cross join normalized n
    where o.order_number ilike n.pattern escape E'\\'
       or o.id::text = btrim(p_query)
       or coalesce(customer.phone_number, '') ilike n.pattern escape E'\\'
    union all
    select
      'DELIVERY_TASK', d.id, d.id::text, 'Delivery task',
      d.status::text, d.updated_at
    from public.delivery_tasks d
    cross join normalized n
    where d.id::text ilike n.pattern escape E'\\'
    union all
    select
      'MERCHANT', m.user_id, coalesce(p.full_name, m.legal_name),
      m.legal_name, m.onboarding_status::text, m.updated_at
    from public.merchant_profiles m
    join public.profiles p on p.id = m.user_id
    cross join normalized n
    where coalesce(p.full_name,'') ilike n.pattern escape E'\\'
       or m.legal_name ilike n.pattern escape E'\\'
       or coalesce(p.phone_number,'') ilike n.pattern escape E'\\'
       or m.user_id::text = btrim(p_query)
    union all
    select
      'CAPTAIN', c.user_id, coalesce(p.full_name, c.captain_code),
      c.captain_code, c.availability_status::text, c.updated_at
    from public.captain_profiles c
    join public.profiles p on p.id = c.user_id
    cross join normalized n
    where c.captain_code ilike n.pattern escape E'\\'
       or coalesce(p.full_name,'') ilike n.pattern escape E'\\'
       or coalesce(p.phone_number,'') ilike n.pattern escape E'\\'
       or c.user_id::text = btrim(p_query)
    union all
    select
      'CASE', s.id, s.ticket_number, s.subject,
      s.status::text, s.updated_at
    from public.support_tickets s
    cross join normalized n
    where s.ticket_number ilike n.pattern escape E'\\'
       or s.subject ilike n.pattern escape E'\\'
       or s.id::text = btrim(p_query)
  )
  select jsonb_build_object(
    'result_type', result_type,
    'resource_id', resource_id,
    'primary_text', primary_text,
    'secondary_text', secondary_text,
    'status', status,
    'updated_at', updated_at
  )
  from results
  order by updated_at desc
  limit (select result_limit from normalized)
$$;

revoke all on function public.get_admin_operations_dashboard()
  from public, anon, authenticated;
revoke all on function public.search_admin_operations(text,integer)
  from public, anon, authenticated;
grant execute on function public.get_admin_operations_dashboard()
  to service_role;
grant execute on function public.search_admin_operations(text,integer)
  to service_role;
