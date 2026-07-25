-- The event-trigger function is invoked by PostgreSQL itself and must never be exposed
-- through PostgREST RPC. PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default, which also reaches anon and authenticated through role inheritance.

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
