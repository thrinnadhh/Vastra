begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(14);

select ok(
  to_regprocedure(
    'private.claim_outbox_events(text,integer)'
  ) is not null,
  'outbox claim function exists'
);

select ok(
  to_regprocedure(
    'private.complete_outbox_event(uuid,text)'
  ) is not null,
  'outbox completion function exists'
);

select ok(
  to_regprocedure(
    'private.fail_outbox_event(uuid,text,text,timestamptz)'
  ) is not null,
  'outbox failure function exists'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'claim_outbox_events'
      and p.prosecdef
      and lower(p.prosrc) like '%skip locked%'
  ),
  'outbox workers use security definer and SKIP LOCKED'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'reserve_inventory'
      and lower(p.prosrc) like '%for update%'
  ),
  'inventory reservation locks the balance row'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'accept_delivery_assignment'
      and lower(p.prosrc) like '%for update%'
  ),
  'delivery assignment locks the offer and task'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.claim_outbox_events(text,integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot claim outbox work'
);

select ok(
  has_function_privilege(
    'service_role',
    'private.claim_outbox_events(text,integer)',
    'EXECUTE'
  ),
  'service role can claim outbox work'
);

select ok(
  to_regclass(
    'public.shops_location_gist_idx'
  ) is not null,
  'shop geospatial index exists'
);

select ok(
  to_regclass(
    'public.products_search_vector_gin_idx'
  ) is not null,
  'product search-vector index exists'
);

select ok(
  to_regclass(
    'public.orders_shop_status_created_idx'
  ) is not null,
  'merchant order queue index exists'
);

select ok(
  to_regclass(
    'public.delivery_assignments_captain_status_idx'
  ) is not null,
  'captain assignment queue index exists'
);

select ok(
  to_regclass(
    'public.notifications_user_unread_idx'
  ) is not null,
  'unread notification index exists'
);

select ok(
  to_regclass(
    'public.outbox_events_worker_idx'
  ) is not null,
  'outbox worker index exists'
);

select * from finish();

rollback;
