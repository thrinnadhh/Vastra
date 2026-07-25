-- The event-trigger function is invoked by PostgreSQL itself and must never be exposed
-- through PostgREST RPC. It is Supabase-platform-owned and may be absent from some local
-- database images, so keep this migration portable while enforcing the restriction whenever
-- the platform hook exists.

do $migration$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public;
    revoke execute on function public.rls_auto_enable() from anon;
    revoke execute on function public.rls_auto_enable() from authenticated;
  end if;
end
$migration$;
