begin;

select plan(30);

select ok(
  to_regclass('private.inventory_reservation_requests') is not null,
  'private reservation idempotency receipts exist'
);

select ok(
  to_regprocedure(
    'public.create_customer_cart_reservation(uuid,uuid,integer,integer,uuid,uuid)'
  ) is not null,
  'customer cart reservation RPC exists'
);

select ok(
  to_regprocedure(
    'public.release_customer_cart_reservation(uuid,text,uuid)'
  ) is not null,
  'customer cart reservation release RPC exists'
);

select ok(
  to_regprocedure(
    'public.expire_inventory_reservations(integer)'
  ) is not null,
  'inventory reservation expiry sweep RPC exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_customer_cart_reservation(uuid,uuid,integer,integer,uuid,uuid)',
    'EXECUTE'
  ),
  'service role can create customer reservations'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_customer_cart_reservation(uuid,uuid,integer,integer,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the trusted create RPC'
);

select ok(
  to_regclass(
    'public.inventory_movements_reservation_transition_idx'
  ) is not null,
  'one movement is allowed for each reservation transition'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'f1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'reservation-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'reservation-customer@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'other-reservation-customer@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (
  id,
  account_type,
  full_name,
  status
)
values
  (
    'f1000000-0000-4000-8000-000000000001',
    'MERCHANT',
    'Reservation Merchant',
    'ACTIVE'
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Reservation Customer',
    'ACTIVE'
  ),
  (
    'f1000000-0000-4000-8000-000000000003',
    'CUSTOMER',
    'Other Reservation Customer',
    'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'f1000000-0000-4000-8000-000000000001',
  'Reservation Merchant Legal'
);

insert into public.customer_profiles (user_id)
values
  ('f1000000-0000-4000-8000-000000000002'),
  ('f1000000-0000-4000-8000-000000000003');

insert into public.addresses (
  id,
  user_id,
  label,
  recipient_name,
  phone_number,
  line1,
  area,
  city,
  state,
  postal_code,
  country_code,
  location
)
values (
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'Shop',
  'Reservation Merchant',
  '9000000023',
  'Reservation Street',
  'Tirupati',
  'Tirupati',
  'Andhra Pradesh',
  '517501',
  'IN',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
);

insert into public.shops (
  id,
  merchant_id,
  address_id,
  shop_code,
  name,
  slug,
  phone_number,
  location,
  verification_status,
  operational_status,
  accepts_online_orders
)
values (
  'f3000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'RESERVATION-SHOP',
  'Reservation Shop',
  'reservation-shop',
  '9000000024',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
  'VERIFIED',
  'OPEN',
  true
);

insert into public.products (
  id,
  shop_id,
  category_id,
  name,
  slug,
  brand,
  moderation_status,
  is_active
)
values (
  'f4000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Reservation Kurta',
  'reservation-kurta',
  'Vastra',
  'APPROVED',
  true
);

insert into public.product_variants (
  id,
  product_id,
  shop_id,
  sku,
  colour_name,
  size_label,
  mrp_paise,
  selling_price_paise,
  is_active
)
values (
  'f5000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  'RESERVATION-KURTA-M',
  'Blue',
  'M',
  120000,
  100000,
  true
);

insert into public.carts (
  id,
  customer_id,
  shop_id,
  status
)
values
  (
    'f6000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000002',
    'f3000000-0000-4000-8000-000000000001',
    'ACTIVE'
  ),
  (
    'f6000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000003',
    'f3000000-0000-4000-8000-000000000001',
    'ACTIVE'
  );

insert into public.inventory_balances (
  shop_id,
  variant_id,
  stock_on_hand,
  reserved_quantity,
  damaged_quantity,
  reorder_level
)
values (
  'f3000000-0000-4000-8000-000000000001',
  'f5000000-0000-4000-8000-000000000001',
  3,
  0,
  0,
  1
);

create temporary table reservation_results (
  label text primary key,
  payload jsonb not null
);

insert into reservation_results (label, payload)
select
  'created',
  public.create_customer_cart_reservation(
    'f6000000-0000-4000-8000-000000000001',
    'f5000000-0000-4000-8000-000000000001',
    2,
    900,
    'f7000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000002'
  );

select is(
  (
    select (payload ->> 'replayed')::boolean
    from reservation_results
    where label = 'created'
  ),
  false,
  'first reservation request is not a replay'
);

select is(
  (
    select payload ->> 'status'
    from reservation_results
    where label = 'created'
  ),
  'ACTIVE',
  'new reservation is active'
);

select is(
  (
    select reserved_quantity::integer
    from public.inventory_balances
    where variant_id =
      'f5000000-0000-4000-8000-000000000001'
  ),
  2,
  'reservation increments reserved quantity'
);

select is(
  (
    select (
      stock_on_hand
      - reserved_quantity
      - damaged_quantity
    )::integer
    from public.inventory_balances
    where variant_id =
      'f5000000-0000-4000-8000-000000000001'
  ),
  1,
  'reservation reduces available quantity'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where movement_type = 'ONLINE_ORDER_RESERVED'
      and reference_id = (
        select (payload ->> 'id')::uuid
        from reservation_results
        where label = 'created'
      )
  ),
  1,
  'reservation creates one immutable reserve movement'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events
    where event_type = 'inventory.balance.changed'
      and payload ->> 'action' = 'RESERVE'
      and payload ->> 'reservationId' = (
        select payload ->> 'id'
        from reservation_results
        where label = 'created'
      )
  ),
  1,
  'reservation enqueues one availability event'
);

insert into reservation_results (label, payload)
select
  'replay',
  public.create_customer_cart_reservation(
    'f6000000-0000-4000-8000-000000000001',
    'f5000000-0000-4000-8000-000000000001',
    2,
    900,
    'f7000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000002'
  );

select is(
  (
    select (payload ->> 'replayed')::boolean
    from reservation_results
    where label = 'replay'
  ),
  true,
  'identical reservation request safely replays'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where movement_type = 'ONLINE_ORDER_RESERVED'
      and reference_id = (
        select (payload ->> 'id')::uuid
        from reservation_results
        where label = 'created'
      )
  ),
  1,
  'idempotent replay does not create another movement'
);

create temporary table reservation_errors (
  label text primary key,
  sqlstate text not null
);

do $$
begin
  begin
    perform public.create_customer_cart_reservation(
      'f6000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      1,
      900,
      'f7000000-0000-4000-8000-000000000001',
      'f1000000-0000-4000-8000-000000000002'
    );

    insert into reservation_errors values ('idempotency', 'NONE');
  exception
    when others then
      insert into reservation_errors values ('idempotency', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from reservation_errors
    where label = 'idempotency'
  ),
  'P0002',
  'changed payload with the same idempotency key is rejected'
);

do $$
begin
  begin
    perform public.create_customer_cart_reservation(
      'f6000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      1,
      900,
      'f7000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000002'
    );

    insert into reservation_errors values ('duplicate_active', 'NONE');
  exception
    when others then
      insert into reservation_errors values ('duplicate_active', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from reservation_errors
    where label = 'duplicate_active'
  ),
  '23505',
  'one cart cannot hold two active reservations for the same variant'
);

insert into reservation_results (label, payload)
select
  'released',
  public.release_customer_cart_reservation(
    (
      select (payload ->> 'id')::uuid
      from reservation_results
      where label = 'created'
    ),
    'Removed from cart',
    'f1000000-0000-4000-8000-000000000002'
  );

select is(
  (
    select payload ->> 'status'
    from reservation_results
    where label = 'released'
  ),
  'RELEASED',
  'customer release finalizes the reservation'
);

select is(
  (
    select reserved_quantity::integer
    from public.inventory_balances
    where variant_id =
      'f5000000-0000-4000-8000-000000000001'
  ),
  0,
  'release restores available quantity'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where movement_type = 'ONLINE_ORDER_RELEASED'
      and reference_id = (
        select (payload ->> 'id')::uuid
        from reservation_results
        where label = 'created'
      )
  ),
  1,
  'release creates one immutable release movement'
);

insert into reservation_results (label, payload)
select
  'release_replay',
  public.release_customer_cart_reservation(
    (
      select (payload ->> 'id')::uuid
      from reservation_results
      where label = 'created'
    ),
    'Removed from cart',
    'f1000000-0000-4000-8000-000000000002'
  );

select is(
  (
    select (payload ->> 'replayed')::boolean
    from reservation_results
    where label = 'release_replay'
  ),
  true,
  'repeated release safely replays the final state'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where movement_type = 'ONLINE_ORDER_RELEASED'
      and reference_id = (
        select (payload ->> 'id')::uuid
        from reservation_results
        where label = 'created'
      )
  ),
  1,
  'repeated release does not create another movement'
);

insert into reservation_results (label, payload)
select
  'expiring',
  public.create_customer_cart_reservation(
    'f6000000-0000-4000-8000-000000000001',
    'f5000000-0000-4000-8000-000000000001',
    1,
    900,
    'f7000000-0000-4000-8000-000000000003',
    'f1000000-0000-4000-8000-000000000002'
  );

update public.inventory_reservations
set
  created_at = now() - interval '2 minutes',
  expires_at = now() - interval '1 minute'
where id = (
  select (payload ->> 'id')::uuid
  from reservation_results
  where label = 'expiring'
);

insert into reservation_results (label, payload)
select
  'expiry_sweep',
  public.expire_inventory_reservations(10);

select is(
  (
    select (payload ->> 'expiredCount')::integer
    from reservation_results
    where label = 'expiry_sweep'
  ),
  1,
  'expiry sweep claims one due reservation'
);

select is(
  (
    select status::text
    from public.inventory_reservations
    where id = (
      select (payload ->> 'id')::uuid
      from reservation_results
      where label = 'expiring'
    )
  ),
  'EXPIRED',
  'expiry sweep marks the reservation expired'
);

select is(
  (
    select reserved_quantity::integer
    from public.inventory_balances
    where variant_id =
      'f5000000-0000-4000-8000-000000000001'
  ),
  0,
  'expiry sweep releases reserved inventory'
);

select is(
  (
    public.expire_inventory_reservations(10)
      ->> 'expiredCount'
  )::integer,
  0,
  'repeated expiry sweep does not release the same reservation twice'
);

do $$
begin
  begin
    perform public.create_customer_cart_reservation(
      'f6000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      4,
      900,
      'f7000000-0000-4000-8000-000000000004',
      'f1000000-0000-4000-8000-000000000002'
    );

    insert into reservation_errors values ('insufficient', 'NONE');
  exception
    when others then
      insert into reservation_errors values ('insufficient', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from reservation_errors
    where label = 'insufficient'
  ),
  'P0001',
  'reservation cannot exceed available inventory'
);

do $$
begin
  begin
    perform public.create_customer_cart_reservation(
      'f6000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      1,
      900,
      'f7000000-0000-4000-8000-000000000005',
      'f1000000-0000-4000-8000-000000000003'
    );

    insert into reservation_errors values ('cross_customer', 'NONE');
  exception
    when others then
      insert into reservation_errors values ('cross_customer', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from reservation_errors
    where label = 'cross_customer'
  ),
  '23503',
  'a customer cannot reserve against another customer cart'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventory_reservations'
      and policyname = 'inventory_reservations_authorized_read'
      and cmd = 'SELECT'
  ),
  'reservation reads remain protected by customer, merchant, and order RLS'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events
    where event_type = 'inventory.balance.changed'
      and payload ->> 'action' in ('RELEASE', 'EXPIRE')
  ),
  2,
  'release and expiry each enqueue one availability event'
);

select * from finish();

rollback;
