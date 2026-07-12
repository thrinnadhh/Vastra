begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(67);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'delivery_task_type'
  ),
  'FORWARD_DELIVERY,RETURN_PICKUP,RETURN_TO_MERCHANT,EXCHANGE_DELIVERY',
  'delivery task types are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'delivery_task_status'
  ),
  'CREATED,SEARCHING,OFFERED,ASSIGNED,AT_PICKUP,PICKED_UP,IN_TRANSIT,AT_DROP,COMPLETED,FAILED,CANCELLED',
  'delivery task statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'delivery_assignment_status'
  ),
  'OFFERED,ACCEPTED,REJECTED,TIMED_OUT,CANCELLED,RELEASED,COMPLETED',
  'delivery assignment statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'delivery_assigned_by'
  ),
  'AUTO,ADMIN',
  'delivery assignment sources are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'delivery_event_type'
  ),
  'CAPTAIN_ASSIGNED,ARRIVED_AT_STORE,MERCHANT_DELAY,PICKUP_CONFIRMED,LEFT_STORE,ARRIVED_AT_CUSTOMER,DELIVERY_CONFIRMED,CUSTOMER_UNAVAILABLE,INVALID_ADDRESS,CUSTOMER_REFUSED,PACKAGE_DAMAGED,RETURNING_TO_STORE,TASK_COMPLETED,OTHER',
  'delivery event types are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'cod_collection_status'
  ),
  'PENDING_COLLECTION,COLLECTED,DEPOSIT_PENDING,DEPOSITED,RECONCILED,DISPUTED',
  'COD collection statuses are defined'
);

select ok(to_regclass('public.delivery_tasks') is not null, 'delivery tasks exist');
select ok(to_regclass('public.delivery_assignments') is not null, 'delivery assignments exist');
select ok(to_regclass('public.captain_current_locations') is not null, 'current captain locations exist');
select ok(to_regclass('public.captain_location_history') is not null, 'captain location history exists');
select ok(to_regclass('public.delivery_events') is not null, 'delivery events exist');
select ok(to_regclass('public.cod_collections') is not null, 'COD collections exist');

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'delivery_tasks',
        'delivery_assignments',
        'captain_current_locations',
        'captain_location_history',
        'delivery_events',
        'cod_collections'
      )
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  6,
  'all delivery tables force RLS'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('delivery_tasks'),
        ('delivery_assignments'),
        ('captain_current_locations'),
        ('captain_location_history'),
        ('delivery_events'),
        ('cod_collections')
    ) as t(table_name)
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'anonymous clients have no delivery grants'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('delivery_tasks'),
        ('delivery_assignments'),
        ('captain_current_locations'),
        ('captain_location_history'),
        ('delivery_events'),
        ('cod_collections')
    ) as t(table_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'authenticated clients have no delivery grants'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_tasks_order_id_fkey'
  ),
  'delivery tasks reference orders'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_tasks_pickup_shop_id_fkey'
  ),
  'delivery tasks reference pickup shops'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'delivery_tasks_assigned_captain_id_fkey'
  ),
  'delivery tasks reference assigned captains'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.delivery_tasks'::regclass
      and attname = 'pickup_location'
      and atttypid = 'extensions.geography'::regtype
      and not attisdropped
  ),
  'delivery pickup locations use geography'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.delivery_tasks'::regclass
      and attname = 'drop_location'
      and atttypid = 'extensions.geography'::regtype
      and not attisdropped
  ),
  'delivery drop locations use geography'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_tasks_reference_shape'
      and contype = 'c'
  ),
  'delivery task references match their task type'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_tasks_assignment_consistency'
      and contype = 'c'
  ),
  'delivery task captain assignment is constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_tasks_completion_consistency'
      and contype = 'c'
  ),
  'delivery completion timestamps are constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_tasks_pickup_consistency'
      and contype = 'c'
  ),
  'delivery pickup timestamps are constrained'
);

select ok(
  to_regclass('public.delivery_tasks_one_forward_order_idx')
    is not null,
  'orders have at most one active forward delivery'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.delivery_tasks'::regclass
      and tgname = 'set_delivery_tasks_updated_at'
      and not tgisinternal
  ),
  'delivery tasks have an updated_at trigger'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'delivery_assignments_delivery_task_id_fkey'
  ),
  'assignments reference delivery tasks'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_assignments_captain_id_fkey'
  ),
  'assignments reference captains'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'delivery_assignments_assigned_by_user_id_fkey'
  ),
  'manual assignment actors reference profiles'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_assignments_expiry_check'
      and contype = 'c'
  ),
  'assignment offers expire after they are created'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'delivery_assignments_admin_actor_check'
      and contype = 'c'
  ),
  'manual assignments require an admin actor'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'delivery_assignments_response_consistency'
      and contype = 'c'
  ),
  'assignment responses are lifecycle constrained'
);

select ok(
  to_regclass('public.delivery_assignments_one_accepted_idx')
    is not null,
  'delivery tasks have at most one accepted assignment'
);

select ok(
  to_regclass('public.delivery_assignments_one_active_offer_idx')
    is not null,
  'captains receive at most one active offer per task'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_current_locations_captain_id_fkey'
  ),
  'current locations reference captains'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_current_locations_active_task_fkey'
  ),
  'current locations may reference active tasks'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_current_locations_heading_check'
      and contype = 'c'
  ),
  'captain headings are constrained'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_current_locations_battery_check'
      and contype = 'c'
  ),
  'captain battery percentage is constrained'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid =
      'public.captain_current_locations'::regclass
      and tgname =
        'set_captain_current_locations_updated_at'
      and not tgisinternal
  ),
  'current captain locations have an updated_at trigger'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_location_history_captain_id_fkey'
  ),
  'location history references captains'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_location_history_delivery_task_id_fkey'
  ),
  'location history references delivery tasks'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'captain_location_history_received_order'
      and contype = 'c'
  ),
  'location receipt time follows recording time'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid =
      'public.captain_location_history'::regclass
      and tgname =
        'prevent_captain_location_history_mutation'
      and not tgisinternal
  ),
  'captain location history is append-only'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_events_delivery_task_id_fkey'
  ),
  'delivery events reference tasks'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_events_actor_user_id_fkey'
  ),
  'delivery event actors reference profiles'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_events_metadata_object'
      and contype = 'c'
  ),
  'delivery event metadata must be a JSON object'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.delivery_events'::regclass
      and tgname = 'prevent_delivery_event_mutation'
      and not tgisinternal
  ),
  'delivery events are append-only'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'cod_collections_order_id_fkey'
  ),
  'COD collections reference orders'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'cod_collections_delivery_task_id_fkey'
  ),
  'COD collections reference delivery tasks'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'cod_collections_captain_id_fkey'
  ),
  'COD collections reference captains'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'cod_collections_reconciled_by_fkey'
  ),
  'COD reconciliation actors reference profiles'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'cod_collections_order_id_key'
      and contype = 'u'
  ),
  'orders have at most one COD collection'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.cod_collections'::regclass
      and attname = 'amount_paise'
      and atttypid = 'public.money_paise'::regtype
      and not attisdropped
  ),
  'COD amounts use integer paise'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'cod_collections_lifecycle_check'
      and contype = 'c'
  ),
  'COD lifecycle timestamps are constrained'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'accept_delivery_assignment'
  ),
  'locked delivery-assignment function exists'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'accept_delivery_assignment'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0,
  'anonymous clients cannot accept assignments'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'accept_delivery_assignment'
      and has_function_privilege(
        'authenticated',
        p.oid,
        'EXECUTE'
      )
  ),
  0,
  'authenticated clients cannot accept assignments directly'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'accept_delivery_assignment'
      and has_function_privilege(
        'service_role',
        p.oid,
        'EXECUTE'
      )
  ),
  1,
  'service role can accept an assignment'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'update_captain_location'
  ),
  'trusted captain location function exists'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'update_captain_location'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0,
  'anonymous clients cannot update captain locations'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'update_captain_location'
      and has_function_privilege(
        'authenticated',
        p.oid,
        'EXECUTE'
      )
  ),
  0,
  'authenticated clients cannot update captain locations directly'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'update_captain_location'
      and has_function_privilege(
        'service_role',
        p.oid,
        'EXECUTE'
      )
  ),
  1,
  'service role can update captain locations'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'accept_delivery_assignment'
      and p.prosecdef
  ),
  'delivery assignment function is security definer'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'update_captain_location'
      and p.prosecdef
  ),
  'captain location function is security definer'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid =
      'public.captain_location_history'::regclass
      and attname = 'id'
      and attidentity = 'a'
      and not attisdropped
  ),
  'captain location history uses identity IDs'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.delivery_events'::regclass
      and attname = 'id'
      and attidentity = 'a'
      and not attisdropped
  ),
  'delivery events use identity IDs'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('captain_location_history_id_seq'),
        ('delivery_events_id_seq')
    ) as s(sequence_name)
    where has_sequence_privilege(
      'anon',
      format('public.%I', sequence_name),
      'USAGE'
    )
  ),
  0,
  'anonymous clients cannot use delivery sequences'
);

select * from finish();

rollback;
