begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(4);

select ok(
  to_regprocedure('public.rls_auto_enable()') is null
  or exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.prosecdef
      and p.proconfig @> array['search_path=pg_catalog']::text[]
  ),
  'the optional platform RLS hook keeps its hardened execution context'
);

select ok(
  to_regprocedure('public.rls_auto_enable()') is null
  or not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(
      coalesce(
        p.proacl,
        acldefault('f', p.proowner)
      )
    ) privilege
    where p.oid = to_regprocedure('public.rls_auto_enable()')
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute the optional RLS event-trigger function'
);

select ok(
  to_regprocedure('public.rls_auto_enable()') is null
  or not has_function_privilege(
    'anon',
    'public.rls_auto_enable()',
    'EXECUTE'
  ),
  'anonymous clients cannot execute the optional RLS event-trigger function'
);

select ok(
  to_regprocedure('public.rls_auto_enable()') is null
  or not has_function_privilege(
    'authenticated',
    'public.rls_auto_enable()',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the optional RLS event-trigger function'
);

select * from finish();

rollback;
