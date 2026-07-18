begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.admin_cancel_order_operation(uuid,uuid,text,text,text,uuid)') is not null, 'narrow admin cancellation exists');
select ok(to_regprocedure('public.admin_retry_order_dispatch(uuid,uuid,text,text,text,uuid)') is not null, 'narrow dispatch retry exists');
select ok(to_regprocedure('public.admin_release_delivery_operation(uuid,uuid,text,text,text,uuid)') is not null, 'audited delivery release exists');
select ok(to_regprocedure('public.admin_reset_delivery_verification(uuid,uuid,text,text,text,text,uuid)') is not null, 'verification reset exists without exposing secrets');
select ok(not has_function_privilege('authenticated', 'public.admin_cancel_order_operation(uuid,uuid,text,text,text,uuid)', 'EXECUTE'), 'clients cannot cancel orders as admin');
select ok(not has_function_privilege('authenticated', 'public.admin_reset_delivery_verification(uuid,uuid,text,text,text,text,uuid)', 'EXECUTE'), 'clients cannot reset delivery verification');
select ok(has_function_privilege('service_role', 'public.admin_retry_order_dispatch(uuid,uuid,text,text,text,uuid)', 'EXECUTE'), 'service role can retry dispatch');
select ok(
  pg_get_functiondef('public.admin_reset_delivery_verification(uuid,uuid,text,text,text,text,uuid)'::regprocedure)
    not like '%pickupCode%' and
  pg_get_functiondef('public.admin_reset_delivery_verification(uuid,uuid,text,text,text,text,uuid)'::regprocedure)
    not like '%deliveryOtp%',
  'verification reset does not return raw secrets'
);

select * from finish();
rollback;
