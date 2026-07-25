begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(5);

select ok(
  to_regprocedure('public.rls_auto_enable()') is not null,
  'RLS auto-enable event-trigger function exists'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.prosecdef
      and p.proconfig @> array['search_path=pg_catalog']::text[]
  ),
  'RLS auto-enable function remains SECURITY DEFINER with a fixed pg_catalog search path'
);

select ok(
  not has_function_privilege(
    'public',
    'public.rls_auto_enable()',
    'EXECUTE'
  ),
  'PUBLIC cannot execute the RLS event-trigger function'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.rls_auto_enable()',
    'EXECUTE'
  ),
  'anonymous clients cannot execute the RLS event-trigger function'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.rls_auto_enable()',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the RLS event-trigger function'
);

select * from finish();

rollback;
