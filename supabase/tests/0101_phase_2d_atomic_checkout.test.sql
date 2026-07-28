begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select has_column('public', 'checkout_quotes', 'contract_version',
  'checkout quotes are versioned');
select has_column('public', 'checkout_quotes', 'merchant_branch_id',
  'checkout quotes select an exact branch');
select has_column('public', 'checkout_quotes', 'city_id',
  'checkout quotes snapshot city identity');
select has_column('public', 'checkout_quotes', 'service_zone_id',
  'checkout quotes snapshot service zone identity');
select has_column('public', 'checkout_quotes', 'fulfilment_mode',
  'checkout quotes distinguish local and postal fulfilment');
select has_column('public', 'checkout_quotes', 'commercial_snapshot',
  'checkout quotes persist commercial configuration');

select has_column('public', 'orders', 'order_contract_version',
  'orders are contract-versioned');
select has_column('public', 'orders', 'merchant_branch_id',
  'orders store the immutable fulfilment branch');
select has_column('public', 'orders', 'city_id',
  'orders store immutable city identity');
select has_column('public', 'orders', 'service_zone_id',
  'orders store immutable service-zone identity');
select has_column('public', 'orders', 'fulfilment_mode',
  'orders separate local and postal modes');
select has_column('public', 'orders', 'branch_snapshot',
  'orders persist branch snapshot');
select has_column('public', 'orders', 'geography_snapshot',
  'orders persist geography snapshot');
select has_column('public', 'orders', 'commercial_snapshot',
  'orders persist commercial snapshot');

select has_column('public', 'order_items',
  'branch_inventory_version_snapshot',
  'order lines snapshot branch inventory versions');
select has_column('public', 'order_items',
  'branch_inventory_reservation_id',
  'order lines reference exact branch reservations');

select ok(
  to_regprocedure(
    'public.create_customer_branch_checkout_quote(uuid,uuid)'
  ) is not null,
  'branch-aware checkout quote RPC exists'
);
select ok(
  to_regprocedure(
    'public.place_customer_branch_cod_order(uuid,uuid,uuid,uuid,text,uuid)'
  ) is not null,
  'branch-aware COD placement RPC exists'
);
select ok(
  to_regprocedure(
    'public.prepare_customer_branch_online_payment(uuid,uuid,uuid,uuid,text,uuid)'
  ) is not null,
  'branch-aware online preparation RPC exists'
);
select ok(
  to_regprocedure(
    'public.attach_customer_branch_payment_session(uuid,uuid,text,text,text,bigint,text,timestamptz)'
  ) is not null,
  'branch-aware payment-session attachment RPC exists'
);
select ok(
  to_regprocedure(
    'public.expire_pending_branch_checkout_orders(integer)'
  ) is not null,
  'order-aware payment expiry worker exists'
);

select ok(
  to_regprocedure(
    'public.create_customer_checkout_quote(uuid,uuid)'
  ) is not null,
  'legacy checkout quote RPC remains available during stacked rollout'
);
select ok(
  to_regprocedure(
    'public.place_customer_cod_order(uuid,uuid,uuid,uuid,text,uuid)'
  ) is not null,
  'legacy COD placement RPC remains available during stacked rollout'
);
select ok(
  to_regprocedure(
    'public.prepare_customer_online_payment(uuid,uuid,uuid,uuid,text,uuid)'
  ) is not null,
  'legacy online preparation RPC remains available during stacked rollout'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_customer_branch_checkout_quote(uuid,uuid)',
    'EXECUTE'
  ),
  'clients cannot invoke the trusted branch quote RPC directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.create_customer_branch_checkout_quote(uuid,uuid)',
    'EXECUTE'
  ),
  'service role can invoke the branch quote RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.place_customer_branch_cod_order(uuid,uuid,uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'clients cannot invoke branch order placement directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.place_customer_branch_cod_order(uuid,uuid,uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'service role can place branch COD orders'
);

select ok(
  pg_get_functiondef(
    'private.create_branch_order_from_quote(uuid,uuid,uuid,uuid,text,uuid,text,uuid,timestamptz)'::regprocedure
  ) like '%order by ci.variant_id%',
  'multi-line branch inventory is acquired in deterministic variant order'
);
select ok(
  pg_get_functiondef(
    'private.create_branch_order_from_quote(uuid,uuid,uuid,uuid,text,uuid,text,uuid,timestamptz)'::regprocedure
  ) like '%reserve_branch_inventory%',
  'order placement uses branch inventory reservations'
);
select ok(
  pg_get_functiondef(
    'private.create_branch_order_from_quote(uuid,uuid,uuid,uuid,text,uuid,text,uuid,timestamptz)'::regprocedure
  ) like '%convert_branch_inventory_reservation%',
  'COD placement converts branch inventory in the transaction'
);
select ok(
  pg_get_functiondef(
    'private.apply_verified_payment_event(bigint)'::regprocedure
  ) like '%branch_inventory_reservations%',
  'verified payment events manage branch reservations'
);
select ok(
  pg_get_functiondef(
    'private.apply_verified_payment_event(bigint)'::regprocedure
  ) like '%BRANCH_RESERVATION_UNAVAILABLE_AFTER_PAYMENT%',
  'captured payments fail closed when their stock hold is missing'
);
select ok(
  pg_get_functiondef(
    'private.expire_branch_inventory_reservations(integer)'::regprocedure
  ) like '%PAYMENT_PENDING%',
  'generic reservation expiry excludes payment-pending Phase 2D orders'
);

select * from finish();
rollback;
