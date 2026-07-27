begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(
  to_regprocedure(
    'public.admin_approve_merchant(uuid,uuid,text,text,text,uuid)'
  ) is not null,
  'merchant approval RPC exists'
);
select ok(
  to_regprocedure(
    'public.admin_approve_captain(uuid,uuid,text,text,text,uuid)'
  ) is not null,
  'captain approval RPC exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.admin_approve_merchant(uuid,uuid,text,text,text,uuid)',
    'EXECUTE'
  ),
  'clients cannot bypass merchant approval'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.admin_approve_captain(uuid,uuid,text,text,text,uuid)',
    'EXECUTE'
  ),
  'clients cannot bypass captain approval'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.admin_approve_merchant(uuid,uuid,text,text,text,uuid)',
    'EXECUTE'
  ),
  'service role can execute merchant approval'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.admin_approve_captain(uuid,uuid,text,text,text,uuid)',
    'EXECUTE'
  ),
  'service role can execute captain approval'
);

select * from finish();
rollback;
