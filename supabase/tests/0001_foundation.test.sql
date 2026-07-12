begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(4);

select ok(
  to_regnamespace('public') is not null,
  'public schema exists'
);

select ok(
  to_regnamespace('auth') is not null,
  'Supabase auth schema exists'
);

select ok(
  exists (
    select 1
    from pg_extension
    where extname = 'pgcrypto'
  ),
  'pgcrypto extension is installed'
);

select ok(
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260712000100'
  ),
  'foundation migration is recorded'
);

select * from finish();

rollback;
