begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('f1000000-0000-4000-8000-000000000001','authenticated','authenticated',
 'p2d-merchant@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000011','authenticated','authenticated',
 'p2d-customer-1@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000012','authenticated','authenticated',
 'p2d-customer-2@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000013','authenticated','authenticated',
 'p2d-customer-3@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000014','authenticated','authenticated',
 'p2d-customer-4@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000015','authenticated','authenticated',
 'p2d-customer-5@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000016','authenticated','authenticated',
 'p2d-customer-6@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000017','authenticated','authenticated',
 'p2d-customer-7@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.profiles(id,account_type,full_name,status) values
('f1000000-0000-4000-8000-000000000001','MERCHANT','P2D Merchant','ACTIVE'),
('f1000000-0000-4000-8000-000000000011','CUSTOMER','P2D Customer 1','ACTIVE'),
('f1000000-0000-4000-8000-000000000012','CUSTOMER','P2D Customer 2','ACTIVE'),
('f1000000-0000-4000-8000-000000000013','CUSTOMER','P2D Customer 3','ACTIVE'),
('f1000000-0000-4000-8000-000000000014','CUSTOMER','P2D Customer 4','ACTIVE'),
('f1000000-0000-4000-8000-000000000015','CUSTOMER','P2D Customer 5','ACTIVE'),
('f1000000-0000-4000-8000-000000000016','CUSTOMER','P2D Customer 6','ACTIVE'),
('f1000000-0000-4000-8000-000000000017','CUSTOMER','P2D Customer 7','ACTIVE');

insert into public.merchant_profiles(
  user_id,legal_name,onboarding_status,kyc_status
) values (
  'f1000000-0000-4000-8000-000000000001',
  'P2D Merchant Legal','ACTIVE','VERIFIED'
);

insert into public.customer_profiles(user_id) values
('f1000000-0000-4000-8000-000000000011'),
('f1000000-0000-4000-8000-000000000012'),
('f1000000-0000-4000-8000-000000000013'),
('f1000000-0000-4000-8000-000000000014'),
('f1000000-0000-4000-8000-000000000015'),
('f1000000-0000-4000-8000-000000000016'),
('f1000000-0000-4000-8000-000000000017');

insert into public.addresses(
  id,user_id,label,recipient_name,phone_number,line1,area,city,state,
  postal_code,country_code,location
) values
('f2000000-0000-4000-8000-000000000001',
 'f1000000-0000-4000-8000-000000000001',
 'Merchant','Merchant','9000000301','1 Branch Road','Central','Tirupati',
 'Andhra Pradesh','517501','IN',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography),
('f2000000-0000-4000-8000-000000000011',
 'f1000000-0000-4000-8000-000000000011',
 'Home','Customer 1','9000000311','11 Home Road','Central','Tirupati',
 'Andhra Pradesh','517501','IN',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography),
('f2000000-0000-4000-8000-000000000012',
 'f1000000-0000-4000-8000-000000000012',
 'Home','Customer 2','9000000312','12 Home Road','Central','Tirupati',
 'Andhra Pradesh','517501','IN',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography),
('f2000000-0000-4000-8000-000000000013',
 'f1000000-0000-4000-8000-000000000013',
 'Home','Customer 3','9000000313','13 Home Road','Central','Tirupati',
 'Andhra Pradesh','517501','IN',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography),
('f2000000-0000-4000-8000-000000000014',
 'f1000000-0000-4000-8000-000000000014',
 'Home','Customer 4','9000000314','14 Home Road','Central','Tirupati',
 'Andhra Pradesh','517501','IN',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography),
('f2000000-0000-4000-8000-000000000015',
 'f1000000-0000-4000-8000-000000000015',
 'Home','Customer 5','9000000315','15 Home Road','Central','Tirupati',
 'Andhra Pradesh','517501','IN',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography),
('f2000000-0000-4000-8000-000000000016',
 'f1000000-0000-4000-8000-000000000016',
 'Home','Customer 6','9000000316','16 Home Road','Central','Tirupati',
 'Andhra Pradesh','517501','IN',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography),
('f2000000-0000-4000-8000-000000000017',
 'f1000000-0000-4000-8000-000000000017',
 'Home','Customer 7','9000000317','17 Home Road','Central','Tirupati',
 'Andhra Pradesh','517501','IN',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography);

insert into public.cities(id,code,slug,name,state_code) values (
 'f6000000-0000-4000-8000-000000000001',
 'P2D_TIRUPATI','p2d-tirupati','Tirupati','AP'
);
update public.cities set status='CONFIGURING'
where id='f6000000-0000-4000-8000-000000000001';
update public.cities set status='READY_FOR_VALIDATION'
where id='f6000000-0000-4000-8000-000000000001';
update public.cities set status='ACTIVE'
where id='f6000000-0000-4000-8000-000000000001';

update public.city_configurations
set default_delivery_radius_meters=5000,
    maximum_delivery_radius_meters=10000,
    base_delivery_fee_paise=3000,
    per_km_delivery_fee_paise=500,
    default_cod_limit_paise=200000,
    merchant_commission_bps=800,
    local_delivery_enabled=true,
    postal_delivery_enabled=true,
    cancellation_policy='{"windowMinutes":10}'::jsonb,
    refund_policy='{"mode":"original"}'::jsonb
where city_id='f6000000-0000-4000-8000-000000000001';

insert into public.service_zones(
  id,city_id,code,slug,name,boundary,center_point,
  default_delivery_radius_meters
) values (
 'f6100000-0000-4000-8000-000000000001',
 'f6000000-0000-4000-8000-000000000001',
 'P2D_CENTRAL','p2d-central','P2D Central',
 extensions.st_multi(extensions.st_geomfromtext(
  'POLYGON((79.35 13.55,79.50 13.55,79.50 13.70,79.35 13.70,79.35 13.55))',
  4326)),
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,6000
);
update public.service_zones set status='CONFIGURING'
where id='f6100000-0000-4000-8000-000000000001';
update public.service_zones set status='READY_FOR_VALIDATION'
where id='f6100000-0000-4000-8000-000000000001';
update public.service_zones set status='ACTIVE'
where id='f6100000-0000-4000-8000-000000000001';

insert into public.service_zone_pincodes(
 city_id,service_zone_id,pincode,priority,is_primary,is_active
) values (
 'f6000000-0000-4000-8000-000000000001',
 'f6100000-0000-4000-8000-000000000001','517501',10,true,true
);

insert into public.shops(
 id,merchant_id,address_id,shop_code,name,slug,phone_number,location,
 verification_status,operational_status,accepts_online_orders,
 minimum_order_paise
) values (
 'f3000000-0000-4000-8000-000000000001',
 'f1000000-0000-4000-8000-000000000001',
 'f2000000-0000-4000-8000-000000000001',
 'P2D-SHOP','P2D Shop','p2d-shop','9100000301',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
 'VERIFIED','OPEN',true,10000
);

insert into public.products(
 id,shop_id,category_id,name,slug,moderation_status,is_active
) values
('f4000000-0000-4000-8000-000000000001',
 'f3000000-0000-4000-8000-000000000001',
 '30000000-0000-0000-0000-000000000001',
 'P2D Kurta','p2d-kurta','APPROVED',true),
('f4000000-0000-4000-8000-000000000002',
 'f3000000-0000-4000-8000-000000000001',
 '30000000-0000-0000-0000-000000000001',
 'P2D Dupatta','p2d-dupatta','APPROVED',true);

insert into public.product_variants(
 id,product_id,shop_id,sku,colour_name,size_label,
 mrp_paise,selling_price_paise,is_active
) values
('f5000000-0000-4000-8000-000000000001',
 'f4000000-0000-4000-8000-000000000001',
 'f3000000-0000-4000-8000-000000000001',
 'P2D-KURTA-M','Blue','M',60000,50000,true),
('f5000000-0000-4000-8000-000000000002',
 'f4000000-0000-4000-8000-000000000002',
 'f3000000-0000-4000-8000-000000000001',
 'P2D-DUPATTA','Gold','ONE',70000,60000,true);

insert into public.merchant_branches(
 id,shop_id,merchant_id,city_id,primary_service_zone_id,branch_code,
 name,branch_type,address_id,return_address_id,pincode,location,
 local_delivery_enabled,postal_delivery_enabled,all_india_postal_enabled,
 accepts_walk_in,postal_dispatch_sla_hours
) values
('f3100000-0000-4000-8000-000000000001',
 'f3000000-0000-4000-8000-000000000001',
 'f1000000-0000-4000-8000-000000000001',
 'f6000000-0000-4000-8000-000000000001',
 'f6100000-0000-4000-8000-000000000001',
 'P2D-LOCAL-INCOMPLETE','Incomplete Local','PHYSICAL_STORE',
 'f2000000-0000-4000-8000-000000000001',
 'f2000000-0000-4000-8000-000000000001','517501',
 'SRID=4326;POINT(79.4190 13.6285)'::extensions.geography,
 true,false,false,true,48),
('f3100000-0000-4000-8000-000000000002',
 'f3000000-0000-4000-8000-000000000001',
 'f1000000-0000-4000-8000-000000000001',
 'f6000000-0000-4000-8000-000000000001',
 'f6100000-0000-4000-8000-000000000001',
 'P2D-LOCAL-COMPLETE','Complete Local','PHYSICAL_STORE',
 'f2000000-0000-4000-8000-000000000001',
 'f2000000-0000-4000-8000-000000000001','517501',
 'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
 true,false,false,true,48),
('f3100000-0000-4000-8000-000000000003',
 'f3000000-0000-4000-8000-000000000001',
 'f1000000-0000-4000-8000-000000000001',
 'f6000000-0000-4000-8000-000000000001',
 'f6100000-0000-4000-8000-000000000001',
 'P2D-POSTAL','Postal Branch','CLOUD_SHOP',
 'f2000000-0000-4000-8000-000000000001',
 'f2000000-0000-4000-8000-000000000001','517501',
 'SRID=4326;POINT(79.4300 13.6350)'::extensions.geography,
 false,true,false,false,24);

insert into public.branch_service_zones(
 branch_id,city_id,service_zone_id,is_primary,is_active
) values
('f3100000-0000-4000-8000-000000000001',
 'f6000000-0000-4000-8000-000000000001',
 'f6100000-0000-4000-8000-000000000001',true,true),
('f3100000-0000-4000-8000-000000000002',
 'f6000000-0000-4000-8000-000000000001',
 'f6100000-0000-4000-8000-000000000001',true,true);

insert into public.branch_postal_serviceability(
 branch_id,pincode,is_active
) values (
 'f3100000-0000-4000-8000-000000000003','517501',true
);

update public.merchant_branches
set verification_status='VERIFIED',
    geography_status='VERIFIED',
    status='VERIFICATION_PENDING'
where id in (
 'f3100000-0000-4000-8000-000000000001',
 'f3100000-0000-4000-8000-000000000002',
 'f3100000-0000-4000-8000-000000000003'
);
update public.merchant_branches set status='APPROVED'
where id in (
 'f3100000-0000-4000-8000-000000000001',
 'f3100000-0000-4000-8000-000000000002',
 'f3100000-0000-4000-8000-000000000003'
);
update public.merchant_branches set status='ACTIVE'
where id in (
 'f3100000-0000-4000-8000-000000000001',
 'f3100000-0000-4000-8000-000000000002',
 'f3100000-0000-4000-8000-000000000003'
);

select private.apply_branch_inventory_delta(
 'f3100000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000001',
 10,0,0,0,'STOCK_RECEIVED','SYSTEM',
 'P2D_TEST',null,'incomplete branch',null
);
select private.apply_branch_inventory_delta(
 'f3100000-0000-4000-8000-000000000002',
 'f5000000-0000-4000-8000-000000000001',
 5,0,0,1,'STOCK_RECEIVED','SYSTEM',
 'P2D_TEST',null,'complete branch variant one',null
);
select private.apply_branch_inventory_delta(
 'f3100000-0000-4000-8000-000000000002',
 'f5000000-0000-4000-8000-000000000002',
 4,0,0,0,'STOCK_RECEIVED','SYSTEM',
 'P2D_TEST',null,'complete branch variant two',null
);
select private.apply_branch_inventory_delta(
 'f3100000-0000-4000-8000-000000000003',
 'f5000000-0000-4000-8000-000000000001',
 20,0,0,0,'STOCK_RECEIVED','SYSTEM',
 'P2D_TEST',null,'postal variant one',null
);
select private.apply_branch_inventory_delta(
 'f3100000-0000-4000-8000-000000000003',
 'f5000000-0000-4000-8000-000000000002',
 20,0,0,0,'STOCK_RECEIVED','SYSTEM',
 'P2D_TEST',null,'postal variant two',null
);

create temporary table p2d_results(
 label text primary key,
 payload jsonb not null
);

-- Customer 1: quote and atomic COD placement.
insert into public.carts(id,customer_id,shop_id) values (
 'f7000000-0000-4000-8000-000000000011',
 'f1000000-0000-4000-8000-000000000011',
 'f3000000-0000-4000-8000-000000000001'
);
insert into public.cart_items(
 cart_id,shop_id,variant_id,quantity,unit_price_snapshot_paise
) values
('f7000000-0000-4000-8000-000000000011',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000001',1,50000),
('f7000000-0000-4000-8000-000000000011',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000002',1,60000);

insert into p2d_results values (
 'cod_quote',
 public.create_customer_branch_checkout_quote(
  'f1000000-0000-4000-8000-000000000011',
  'f2000000-0000-4000-8000-000000000011'
 )
);
select is(
 (select payload->>'contractVersion' from p2d_results where label='cod_quote'),
 '2','branch quote uses contract version 2'
);
select is(
 (select payload#>>'{branch,id}' from p2d_results where label='cod_quote'),
 'f3100000-0000-4000-8000-000000000002',
 'one branch that can fulfil every cart line is selected'
);
select is(
 (select (payload#>>'{totals,deliveryFeePaise}')::bigint
  from p2d_results where label='cod_quote'),
 3000::bigint,'delivery fee is authoritative and server-calculated'
);
select is(
 (select (payload->>'codEligible')::boolean
  from p2d_results where label='cod_quote'),
 true,'final order total is inside the city COD limit'
);
select is(
 (select count(*)::integer from public.branch_inventory_reservations),
 0,'quote creation does not reserve branch inventory'
);
select is(
 (select reserved_quantity::integer from public.branch_inventory
  where branch_id='f3100000-0000-4000-8000-000000000002'
    and variant_id='f5000000-0000-4000-8000-000000000001'),
 0,'quote creation does not mutate reserved quantity'
);

insert into p2d_results values (
 'cod_order',
 public.place_customer_branch_cod_order(
  'f1000000-0000-4000-8000-000000000011',
  'f7000000-0000-4000-8000-000000000011',
  (select (payload->>'id')::uuid from p2d_results where label='cod_quote'),
  'f2000000-0000-4000-8000-000000000011',
  'Leave at reception',
  'f8000000-0000-4000-8000-000000000011'
 )
);
select is(
 (select payload->>'status' from p2d_results where label='cod_order'),
 'WAITING_FOR_MERCHANT','COD order is placed for merchant fulfilment'
);
select is(
 (select payload->>'fulfilmentMode' from p2d_results where label='cod_order'),
 'LOCAL_DELIVERY','COD order records local fulfilment mode'
);
select is(
 (select order_contract_version::integer from public.orders
  where id=(select (payload->>'id')::uuid from p2d_results where label='cod_order')),
 2,'placed order uses contract version 2'
);
select is(
 (select merchant_branch_id::text from public.orders
  where id=(select (payload->>'id')::uuid from p2d_results where label='cod_order')),
 'f3100000-0000-4000-8000-000000000002',
 'placed order stores the exact branch'
);
select is(
 (select count(*)::integer from public.branch_inventory_reservations
  where order_id=(select (payload->>'id')::uuid from p2d_results where label='cod_order')
    and status='CONVERTED'),
 2,'COD converts every branch reservation exactly once'
);
select is(
 (select count(*)::integer from public.order_items
  where order_id=(select (payload->>'id')::uuid from p2d_results where label='cod_order')
    and branch_inventory_reservation_id is not null),
 2,'every order line references its exact branch reservation'
);
select is(
 (select stock_on_hand::integer from public.branch_inventory
  where branch_id='f3100000-0000-4000-8000-000000000002'
    and variant_id='f5000000-0000-4000-8000-000000000001'),
 4,'COD decrements branch stock for variant one'
);
select is(
 (select stock_on_hand::integer from public.branch_inventory
  where branch_id='f3100000-0000-4000-8000-000000000002'
    and variant_id='f5000000-0000-4000-8000-000000000002'),
 3,'COD decrements branch stock for variant two'
);
select is(
 (select status::text from public.carts
  where id='f7000000-0000-4000-8000-000000000011'),
 'CONVERTED','successful placement converts the cart'
);
select is(
 public.place_customer_branch_cod_order(
  'f1000000-0000-4000-8000-000000000011',
  'f7000000-0000-4000-8000-000000000011',
  (select (payload->>'id')::uuid from p2d_results where label='cod_quote'),
  'f2000000-0000-4000-8000-000000000011',
  'Leave at reception',
  'f8000000-0000-4000-8000-000000000011'
 )->>'id',
 (select payload->>'id' from p2d_results where label='cod_order'),
 'idempotent replay returns the original order'
);
select throws_ok(
 format(
  'update public.orders set branch_snapshot = branch_snapshot || %L::jsonb where id = %L',
  '{"tampered":true}',
  (select payload->>'id' from p2d_results where label='cod_order')
 ),
 '55000','ORDER_COMMERCIAL_SNAPSHOT_IMMUTABLE',
 'order geography and commercial snapshots are immutable'
);

update public.city_configurations
set base_delivery_fee_paise=4000
where city_id='f6000000-0000-4000-8000-000000000001';
select is(
 (select (commercial_snapshot->>'deliveryFeePaise')::bigint
  from public.orders
  where id=(select (payload->>'id')::uuid from p2d_results where label='cod_order')),
 3000::bigint,'historical order keeps its quoted delivery fee snapshot'
);

-- Customer 2: online hold, provider session and verified capture.
insert into public.carts(id,customer_id,shop_id) values (
 'f7000000-0000-4000-8000-000000000012',
 'f1000000-0000-4000-8000-000000000012',
 'f3000000-0000-4000-8000-000000000001'
);
insert into public.cart_items(
 cart_id,shop_id,variant_id,quantity,unit_price_snapshot_paise
) values
('f7000000-0000-4000-8000-000000000012',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000001',1,50000),
('f7000000-0000-4000-8000-000000000012',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000002',1,60000);
insert into p2d_results values (
 'online_quote',
 public.create_customer_branch_checkout_quote(
  'f1000000-0000-4000-8000-000000000012',
  'f2000000-0000-4000-8000-000000000012'
 )
);
insert into p2d_results values (
 'online_prepare',
 public.prepare_customer_branch_online_payment(
  'f1000000-0000-4000-8000-000000000012',
  'f7000000-0000-4000-8000-000000000012',
  (select (payload->>'id')::uuid from p2d_results where label='online_quote'),
  'f2000000-0000-4000-8000-000000000012',null,
  'f8000000-0000-4000-8000-000000000012'
 )
);
select is(
 (select count(*)::integer from public.branch_inventory_reservations
  where order_id=(select (payload->>'orderId')::uuid
                  from p2d_results where label='online_prepare')
    and status='ACTIVE'),
 2,'online preparation holds every cart line'
);
select is(
 (select stock_on_hand::integer from public.branch_inventory
  where branch_id='f3100000-0000-4000-8000-000000000002'
    and variant_id='f5000000-0000-4000-8000-000000000001'),
 4,'online preparation does not decrement stock on hand'
);

insert into p2d_results values (
 'online_session',
 public.attach_customer_branch_payment_session(
  'f1000000-0000-4000-8000-000000000012',
  (select (payload->>'paymentId')::uuid from p2d_results where label='online_prepare'),
  (select payload->>'providerOrderId' from p2d_results where label='online_prepare'),
  'cf-reference-p2d-2','cf-session-p2d-2',
  (select (payload->>'amountPaise')::bigint from p2d_results where label='online_prepare'),
  'INR',statement_timestamp()+interval '30 minutes'
 )
);
select is(
 (select min(expires_at) from public.branch_inventory_reservations
  where order_id=(select (payload->>'orderId')::uuid
                  from p2d_results where label='online_prepare')
    and status='ACTIVE'),
 (select max(expires_at) from public.branch_inventory_reservations
  where order_id=(select (payload->>'orderId')::uuid
                  from p2d_results where label='online_prepare')
    and status='ACTIVE'),
 'provider-session attachment aligns all reservation expiries'
);

insert into public.payment_events(
 payment_id,provider,provider_event_id,event_type,payload,signature_valid
) values (
 (select (payload->>'paymentId')::uuid from p2d_results where label='online_prepare'),
 'cashfree','p2d-success-1','PAYMENT_SUCCESS',
 jsonb_build_object('_vastra',jsonb_build_object(
  'amountPaise',(select (payload->>'amountPaise')::bigint
                 from p2d_results where label='online_prepare'),
  'currency','INR','providerPaymentId','cf-payment-p2d-2',
  'occurredAt',statement_timestamp()
 )),true
);
select is(
 private.apply_verified_payment_event(
  (select id from public.payment_events where provider_event_id='p2d-success-1')
 ),
 'PROCESSED','verified payment capture is processed'
);
select is(
 (select status::text from public.orders
  where id=(select (payload->>'orderId')::uuid
            from p2d_results where label='online_prepare')),
 'WAITING_FOR_MERCHANT','verified capture activates merchant fulfilment'
);
select is(
 (select count(*)::integer from public.branch_inventory_reservations
  where order_id=(select (payload->>'orderId')::uuid
                  from p2d_results where label='online_prepare')
    and status='CONVERTED'),
 2,'verified capture converts branch reservations'
);
select is(
 (select stock_on_hand::integer from public.branch_inventory
  where branch_id='f3100000-0000-4000-8000-000000000002'
    and variant_id='f5000000-0000-4000-8000-000000000001'),
 3,'verified capture decrements held stock exactly once'
);

insert into public.payment_events(
 payment_id,provider,provider_event_id,event_type,payload,signature_valid
) values (
 (select (payload->>'paymentId')::uuid from p2d_results where label='online_prepare'),
 'cashfree','p2d-success-duplicate','PAYMENT_SUCCESS',
 jsonb_build_object('_vastra',jsonb_build_object(
  'amountPaise',(select (payload->>'amountPaise')::bigint
                 from p2d_results where label='online_prepare'),
  'currency','INR','providerPaymentId','cf-payment-p2d-2',
  'occurredAt',statement_timestamp()
 )),true
);
select is(
 private.apply_verified_payment_event(
  (select id from public.payment_events
   where provider_event_id='p2d-success-duplicate')
 ),
 'IGNORED','duplicate verified capture is ignored'
);
select is(
 (select stock_on_hand::integer from public.branch_inventory
  where branch_id='f3100000-0000-4000-8000-000000000002'
    and variant_id='f5000000-0000-4000-8000-000000000001'),
 3,'duplicate capture cannot decrement stock twice'
);

-- Customer 3: verified payment failure releases all branch holds.
insert into public.carts(id,customer_id,shop_id) values (
 'f7000000-0000-4000-8000-000000000013',
 'f1000000-0000-4000-8000-000000000013',
 'f3000000-0000-4000-8000-000000000001'
);
insert into public.cart_items(
 cart_id,shop_id,variant_id,quantity,unit_price_snapshot_paise
) values
('f7000000-0000-4000-8000-000000000013',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000001',1,50000),
('f7000000-0000-4000-8000-000000000013',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000002',1,60000);
insert into p2d_results values (
 'failure_quote',
 public.create_customer_branch_checkout_quote(
  'f1000000-0000-4000-8000-000000000013',
  'f2000000-0000-4000-8000-000000000013'
 )
);
insert into p2d_results values (
 'failure_prepare',
 public.prepare_customer_branch_online_payment(
  'f1000000-0000-4000-8000-000000000013',
  'f7000000-0000-4000-8000-000000000013',
  (select (payload->>'id')::uuid from p2d_results where label='failure_quote'),
  'f2000000-0000-4000-8000-000000000013',null,
  'f8000000-0000-4000-8000-000000000013'
 )
);
insert into public.payment_events(
 payment_id,provider,provider_event_id,event_type,payload,signature_valid
) values (
 (select (payload->>'paymentId')::uuid from p2d_results where label='failure_prepare'),
 'cashfree','p2d-failure-1','PAYMENT_FAILED',
 jsonb_build_object('_vastra',jsonb_build_object(
  'amountPaise',(select (payload->>'amountPaise')::bigint
                 from p2d_results where label='failure_prepare'),
  'currency','INR','providerPaymentId','cf-payment-p2d-3',
  'occurredAt',statement_timestamp()
 )),true
);
select is(
 private.apply_verified_payment_event(
  (select id from public.payment_events where provider_event_id='p2d-failure-1')
 ),
 'PROCESSED','verified payment failure is processed'
);
select is(
 (select count(*)::integer from public.branch_inventory_reservations
  where order_id=(select (payload->>'orderId')::uuid
                  from p2d_results where label='failure_prepare')
    and status='RELEASED'),
 2,'verified payment failure releases every branch hold'
);
select is(
 (select status::text from public.orders
  where id=(select (payload->>'orderId')::uuid
            from p2d_results where label='failure_prepare')),
 'CANCELLED','verified payment failure cancels the order'
);
select is(
 (select stock_on_hand::integer from public.branch_inventory
  where branch_id='f3100000-0000-4000-8000-000000000002'
    and variant_id='f5000000-0000-4000-8000-000000000001'),
 3,'payment failure does not decrement stock on hand'
);

-- Customer 4: order-aware expiry wins without corrupting stock.
insert into public.carts(id,customer_id,shop_id) values (
 'f7000000-0000-4000-8000-000000000014',
 'f1000000-0000-4000-8000-000000000014',
 'f3000000-0000-4000-8000-000000000001'
);
insert into public.cart_items(
 cart_id,shop_id,variant_id,quantity,unit_price_snapshot_paise
) values
('f7000000-0000-4000-8000-000000000014',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000001',1,50000),
('f7000000-0000-4000-8000-000000000014',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000002',1,60000);
insert into p2d_results values (
 'expiry_quote',
 public.create_customer_branch_checkout_quote(
  'f1000000-0000-4000-8000-000000000014',
  'f2000000-0000-4000-8000-000000000014'
 )
);
insert into p2d_results values (
 'expiry_prepare',
 public.prepare_customer_branch_online_payment(
  'f1000000-0000-4000-8000-000000000014',
  'f7000000-0000-4000-8000-000000000014',
  (select (payload->>'id')::uuid from p2d_results where label='expiry_quote'),
  'f2000000-0000-4000-8000-000000000014',null,
  'f8000000-0000-4000-8000-000000000014'
 )
);
update public.branch_inventory_reservations
set created_at=statement_timestamp()-interval '2 minutes',
    expires_at=statement_timestamp()-interval '1 minute'
where order_id=(select (payload->>'orderId')::uuid
                from p2d_results where label='expiry_prepare')
  and status='ACTIVE';
select is(
 public.expire_pending_branch_checkout_orders(10),
 1,'order-aware worker expires one payment-pending order'
);
select is(
 (select count(*)::integer from public.branch_inventory_reservations
  where order_id=(select (payload->>'orderId')::uuid
                  from p2d_results where label='expiry_prepare')
    and status='EXPIRED'),
 2,'expiry releases all active branch reservations'
);
select is(
 (select status::text from public.orders
  where id=(select (payload->>'orderId')::uuid
            from p2d_results where label='expiry_prepare')),
 'CANCELLED','reservation expiry cancels the payment-pending order'
);

-- Customer 5: a changed inventory version invalidates placement.
insert into public.carts(id,customer_id,shop_id) values (
 'f7000000-0000-4000-8000-000000000015',
 'f1000000-0000-4000-8000-000000000015',
 'f3000000-0000-4000-8000-000000000001'
);
insert into public.cart_items(
 cart_id,shop_id,variant_id,quantity,unit_price_snapshot_paise
) values
('f7000000-0000-4000-8000-000000000015',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000001',1,50000),
('f7000000-0000-4000-8000-000000000015',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000002',1,60000);
insert into p2d_results values (
 'stale_quote',
 public.create_customer_branch_checkout_quote(
  'f1000000-0000-4000-8000-000000000015',
  'f2000000-0000-4000-8000-000000000015'
 )
);
select private.apply_branch_inventory_delta(
 'f3100000-0000-4000-8000-000000000002',
 'f5000000-0000-4000-8000-000000000001',
 1,0,0,0,'STOCK_RECEIVED','SYSTEM',
 'P2D_TEST',null,'stale quote version change',null
);
select throws_ok(
 format(
  'select public.place_customer_branch_cod_order(%L::uuid,%L::uuid,%L::uuid,%L::uuid,null,%L::uuid)',
  'f1000000-0000-4000-8000-000000000015',
  'f7000000-0000-4000-8000-000000000015',
  (select payload->>'id' from p2d_results where label='stale_quote'),
  'f2000000-0000-4000-8000-000000000015',
  'f8000000-0000-4000-8000-000000000015'
 ),
 'P0013','checkout quote no longer matches current state',
 'inventory version changes reject stale placement'
);
select is(
 (select count(*)::integer from public.orders
  where customer_id='f1000000-0000-4000-8000-000000000015'),
 0,'failed stale placement rolls back order creation'
);

-- Customer 6: quote may be displayed, but COD over the city limit is rejected.
insert into public.carts(id,customer_id,shop_id) values (
 'f7000000-0000-4000-8000-000000000016',
 'f1000000-0000-4000-8000-000000000016',
 'f3000000-0000-4000-8000-000000000001'
);
insert into public.cart_items(
 cart_id,shop_id,variant_id,quantity,unit_price_snapshot_paise
) values
('f7000000-0000-4000-8000-000000000016',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000001',2,50000),
('f7000000-0000-4000-8000-000000000016',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000002',2,60000);
insert into p2d_results values (
 'cod_limit_quote',
 public.create_customer_branch_checkout_quote(
  'f1000000-0000-4000-8000-000000000016',
  'f2000000-0000-4000-8000-000000000016'
 )
);
select is(
 (select (payload->>'codEligible')::boolean
  from p2d_results where label='cod_limit_quote'),
 false,'quote reports COD ineligibility above the configured limit'
);
select throws_ok(
 format(
  'select public.place_customer_branch_cod_order(%L::uuid,%L::uuid,%L::uuid,%L::uuid,null,%L::uuid)',
  'f1000000-0000-4000-8000-000000000016',
  'f7000000-0000-4000-8000-000000000016',
  (select payload->>'id' from p2d_results where label='cod_limit_quote'),
  'f2000000-0000-4000-8000-000000000016',
  'f8000000-0000-4000-8000-000000000016'
 ),
 'P0024','COD_NOT_ELIGIBLE',
 'COD placement is rejected above the city limit'
);

-- Customer 7: postal coverage cannot produce a zero-fee order prematurely.
insert into public.carts(id,customer_id,shop_id) values (
 'f7000000-0000-4000-8000-000000000017',
 'f1000000-0000-4000-8000-000000000017',
 'f3000000-0000-4000-8000-000000000001'
);
insert into public.cart_items(
 cart_id,shop_id,variant_id,quantity,unit_price_snapshot_paise
) values
('f7000000-0000-4000-8000-000000000017',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000001',1,50000),
('f7000000-0000-4000-8000-000000000017',
 'f3000000-0000-4000-8000-000000000001',
 'f5000000-0000-4000-8000-000000000002',1,60000);
update public.merchant_branches set status='PAUSED'
where id='f3100000-0000-4000-8000-000000000002';
select throws_ok(
 $$select public.create_customer_branch_checkout_quote(
   'f1000000-0000-4000-8000-000000000017',
   'f2000000-0000-4000-8000-000000000017'
 )$$,
 'P0022','POSTAL_PRICING_REQUIRED',
 'postal-only cart fails closed until courier pricing exists'
);
update public.merchant_branches set status='ACTIVE'
where id='f3100000-0000-4000-8000-000000000002';

select * from finish();
rollback;
