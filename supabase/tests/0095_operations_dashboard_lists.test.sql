begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(
  to_regprocedure(
    'public.list_admin_operational_orders(text,text,timestamptz,uuid,integer)'
  ) is not null,
  'admin operational order list RPC exists'
);
select ok(
  to_regprocedure('public.get_merchant_operations_dashboard(uuid)') is not null,
  'merchant operations dashboard RPC exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.list_admin_operational_orders(text,text,timestamptz,uuid,integer)',
    'EXECUTE'
  ),
  'clients cannot bypass admin order-list authorization'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_merchant_operations_dashboard(uuid)',
    'EXECUTE'
  ),
  'clients cannot bypass merchant dashboard authorization'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.list_admin_operational_orders(text,text,timestamptz,uuid,integer)',
    'EXECUTE'
  ),
  'service role can list operational orders'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_merchant_operations_dashboard(uuid)',
    'EXECUTE'
  ),
  'service role can build a merchant dashboard'
);

select * from finish();
rollback;
