begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select has_table(
  'private',
  'customer_order_cancellation_requests',
  'customer cancellation idempotency receipts exist'
);
select ok(
  to_regprocedure('public.cancel_customer_order(uuid,uuid,uuid)') is not null,
  'customer cancellation RPC exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.cancel_customer_order(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'clients cannot bypass the backend cancellation boundary'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.cancel_customer_order(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'service role can execute customer cancellation'
);
select ok(
  pg_get_functiondef(
    'public.cancel_customer_order(uuid,uuid,uuid)'::regprocedure
  ) like '%private.release_order_inventory_reservations%',
  'customer cancellation releases order-linked inventory'
);
select ok(
  pg_get_functiondef(
    'public.cancel_customer_order(uuid,uuid,uuid)'::regprocedure
  ) like '%private.finish_merchant_alert%',
  'customer cancellation stops the merchant ringing alert'
);
select ok(
  pg_get_functiondef(
    'public.cancel_customer_order(uuid,uuid,uuid)'::regprocedure
  ) like '%insert into public.refunds%',
  'captured payments create a durable refund'
);
select ok(
  pg_get_functiondef(
    'public.reject_merchant_order(uuid,uuid,text,uuid,text)'::regprocedure
  ) like '%private.release_order_inventory_reservations%',
  'merchant rejection releases order-linked inventory'
);
select ok(
  pg_get_functiondef(
    'public.admin_cancel_order_operation(uuid,uuid,text,text,text,uuid)'::regprocedure
  ) like '%private.release_order_inventory_reservations%',
  'admin cancellation releases order-linked inventory'
);

select * from finish();
rollback;
