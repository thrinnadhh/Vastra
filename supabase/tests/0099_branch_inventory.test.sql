begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(26);

select ok(to_regclass('public.branch_inventory') is not null,'branch_inventory exists');
select ok(to_regclass('public.branch_inventory_movements') is not null,'branch inventory ledger exists');
select ok(to_regclass('public.branch_inventory_reservations') is not null,'branch reservations exist');
select is(
 (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('branch_inventory','branch_inventory_movements','branch_inventory_reservations') and c.relrowsecurity),
 3,'branch inventory tables enable RLS');
select is(
 (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('branch_inventory','branch_inventory_movements','branch_inventory_reservations') and c.relforcerowsecurity),
 3,'branch inventory tables force RLS');

insert into auth.users(
 id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('d1000000-0000-4000-8000-000000000001','authenticated','authenticated','inventory-merchant@test.local',crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('d1000000-0000-4000-8000-000000000002','authenticated','authenticated','inventory-customer-one@test.local',crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('d1000000-0000-4000-8000-000000000003','authenticated','authenticated','inventory-customer-two@test.local',crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into public.profiles(id,account_type,full_name,status) values
('d1000000-0000-4000-8000-000000000001','MERCHANT','Inventory Merchant','ACTIVE'),
('d1000000-0000-4000-8000-000000000002','CUSTOMER','Inventory Customer One','ACTIVE'),
('d1000000-0000-4000-8000-000000000003','CUSTOMER','Inventory Customer Two','ACTIVE');
insert into public.merchant_profiles(user_id,legal_name,onboarding_status,kyc_status)
values('d1000000-0000-4000-8000-000000000001','Inventory Merchant Legal','ACTIVE','VERIFIED');
insert into public.customer_profiles(user_id) values
('d1000000-0000-4000-8000-000000000002'),('d1000000-0000-4000-8000-000000000003');
insert into public.addresses(
 id,user_id,label,recipient_name,phone_number,line1,area,city,state,postal_code,country_code,location
) values
('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Branch','Merchant','9000000101','1 Road','Central','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.4192 13.6288)'::extensions.geography),
('d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','Home','Customer One','9000000102','2 Road','Central','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.4200 13.6290)'::extensions.geography),
('d2000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000003','Home','Customer Two','9000000103','3 Road','Central','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.4210 13.6295)'::extensions.geography);
insert into public.cities(id,code,slug,name,state_code)
values('d6000000-0000-4000-8000-000000000001','INV_TIRUPATI','inv-tirupati','Tirupati','AP');
update public.cities set status='CONFIGURING' where id='d6000000-0000-4000-8000-000000000001';
update public.cities set status='READY_FOR_VALIDATION' where id='d6000000-0000-4000-8000-000000000001';
update public.cities set status='ACTIVE' where id='d6000000-0000-4000-8000-000000000001';
insert into public.service_zones(id,city_id,code,slug,name)
values('d6100000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','INV_ZONE','inv-zone','Inventory Zone');
update public.service_zones set status='CONFIGURING' where id='d6100000-0000-4000-8000-000000000001';
update public.service_zones set status='READY_FOR_VALIDATION' where id='d6100000-0000-4000-8000-000000000001';
update public.service_zones set status='ACTIVE' where id='d6100000-0000-4000-8000-000000000001';
insert into public.shops(
 id,merchant_id,address_id,shop_code,name,slug,phone_number,location,verification_status,operational_status,accepts_online_orders
) values('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','INV-SHOP','Inventory Shop','inventory-shop','9100000101','SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,'VERIFIED','OPEN',true);
insert into public.products(id,shop_id,category_id,name,slug,moderation_status,is_active)
values('d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','30000000-0000-0000-0000-000000000001','Inventory Kurta','inventory-kurta','APPROVED',true);
insert into public.product_variants(id,product_id,shop_id,sku,colour_name,size_label,mrp_paise,selling_price_paise,is_active) values
('d5000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','INV-KURTA-M','Blue','M',120000,100000,true),
('d5000000-0000-4000-8000-000000000002','d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','INV-KURTA-L','Blue','L',120000,100000,true);
insert into public.carts(id,customer_id,shop_id,status) values
('d7000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','ACTIVE'),
('d7000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.merchant_branches(
 id,shop_id,merchant_id,city_id,primary_service_zone_id,branch_code,name,branch_type,address_id,return_address_id,pincode,location,local_delivery_enabled
) values('d3100000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','d6100000-0000-4000-8000-000000000001','INV-BRANCH','Inventory Branch','PHYSICAL_STORE','d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','517501','SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,true);
insert into public.branch_service_zones(branch_id,city_id,service_zone_id,is_primary,is_active)
values('d3100000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','d6100000-0000-4000-8000-000000000001',true,true);
update public.merchant_branches set verification_status='VERIFIED',geography_status='VERIFIED',status='VERIFICATION_PENDING'
where id='d3100000-0000-4000-8000-000000000001';
update public.merchant_branches set status='APPROVED' where id='d3100000-0000-4000-8000-000000000001';
update public.merchant_branches set status='ACTIVE' where id='d3100000-0000-4000-8000-000000000001';

select private.apply_branch_inventory_delta(
 'd3100000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001',
 10,0,0,2,'STOCK_RECEIVED','SYSTEM','TEST',null,'initial',null);
select is((select stock_on_hand::integer from public.branch_inventory where branch_id='d3100000-0000-4000-8000-000000000001' and variant_id='d5000000-0000-4000-8000-000000000001'),10,'stock belongs to exact branch');
select is((select available_quantity from public.branch_inventory where branch_id='d3100000-0000-4000-8000-000000000001' and variant_id='d5000000-0000-4000-8000-000000000001'),8,'availability excludes safety stock');

create temporary table inventory_results(label text primary key,payload jsonb not null);
insert into inventory_results select 'created',private.reserve_branch_inventory(
 'd3100000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001',3,
 '2099-01-01'::timestamptz,'d8000000-0000-4000-8000-000000000001',
 'd7000000-0000-4000-8000-000000000001',null,'d1000000-0000-4000-8000-000000000002');
select is((select payload->>'status' from inventory_results where label='created'),'ACTIVE','reservation is active');
select is((select reserved_quantity::integer from public.branch_inventory where branch_id='d3100000-0000-4000-8000-000000000001' and variant_id='d5000000-0000-4000-8000-000000000001'),3,'reservation increments reserved stock');
select is((select available_quantity from public.branch_inventory where branch_id='d3100000-0000-4000-8000-000000000001' and variant_id='d5000000-0000-4000-8000-000000000001'),5,'reservation reduces availability');
insert into inventory_results select 'replay',private.reserve_branch_inventory(
 'd3100000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001',3,
 '2099-01-01'::timestamptz,'d8000000-0000-4000-8000-000000000001',
 'd7000000-0000-4000-8000-000000000001',null,'d1000000-0000-4000-8000-000000000002');
select is((select (payload->>'replayed')::boolean from inventory_results where label='replay'),true,'reservation key replays');
select is((select count(*)::integer from public.branch_inventory_reservations where idempotency_key='d8000000-0000-4000-8000-000000000001'),1,'replay does not duplicate hold');
select throws_ok(
 $$ select private.reserve_branch_inventory(
 'd3100000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001',6,
 '2099-01-01'::timestamptz,'d8000000-0000-4000-8000-000000000099',
 'd7000000-0000-4000-8000-000000000002',null,'d1000000-0000-4000-8000-000000000003') $$,
 'P0001','INSUFFICIENT_BRANCH_STOCK','insufficient branch stock fails atomically');

insert into inventory_results select 'released',private.release_branch_inventory_reservation(
 (select (payload->>'id')::uuid from inventory_results where label='created'),'RELEASED','left checkout','d1000000-0000-4000-8000-000000000002');
select is((select payload->>'status' from inventory_results where label='released'),'RELEASED','release is terminal');
select is((select available_quantity from public.branch_inventory where branch_id='d3100000-0000-4000-8000-000000000001' and variant_id='d5000000-0000-4000-8000-000000000001'),8,'release restores availability');
insert into inventory_results select 'release-replay',private.release_branch_inventory_reservation(
 (select (payload->>'id')::uuid from inventory_results where label='created'),'RELEASED','left checkout','d1000000-0000-4000-8000-000000000002');
select is((select (payload->>'replayed')::boolean from inventory_results where label='release-replay'),true,'release is idempotent');
select is((select count(*)::integer from public.branch_inventory_movements where reference_id=(select (payload->>'id')::uuid from inventory_results where label='created') and movement_type='ONLINE_ORDER_RELEASED'),1,'release writes one movement');

insert into inventory_results select 'convert-hold',private.reserve_branch_inventory(
 'd3100000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001',2,
 '2099-01-01'::timestamptz,'d8000000-0000-4000-8000-000000000002',
 'd7000000-0000-4000-8000-000000000001',null,'d1000000-0000-4000-8000-000000000002');
insert into inventory_results select 'converted',private.convert_branch_inventory_reservation(
 (select (payload->>'id')::uuid from inventory_results where label='convert-hold'),'d1000000-0000-4000-8000-000000000002');
select is((select payload->>'status' from inventory_results where label='converted'),'CONVERTED','conversion commits hold');
select is((select stock_on_hand::integer from public.branch_inventory where branch_id='d3100000-0000-4000-8000-000000000001' and variant_id='d5000000-0000-4000-8000-000000000001'),8,'conversion decrements on-hand stock');
select is((select reserved_quantity::integer from public.branch_inventory where branch_id='d3100000-0000-4000-8000-000000000001' and variant_id='d5000000-0000-4000-8000-000000000001'),0,'conversion clears reserved stock');

insert into inventory_results select 'expire-hold',private.reserve_branch_inventory(
 'd3100000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001',1,
 '2099-01-01'::timestamptz,'d8000000-0000-4000-8000-000000000003',
 'd7000000-0000-4000-8000-000000000002',null,'d1000000-0000-4000-8000-000000000003');
update public.branch_inventory_reservations set created_at=now()-interval '1 day',expires_at=now()-interval '1 second'
where id=(select (payload->>'id')::uuid from inventory_results where label='expire-hold');
select is(private.expire_branch_inventory_reservations(10),1,'expiry worker releases expired hold');
select is((select status::text from public.branch_inventory_reservations where id=(select (payload->>'id')::uuid from inventory_results where label='expire-hold')),'EXPIRED','hold reaches expired state');

select throws_ok(
 $$ update public.branch_inventory_movements set reason='tamper' where id=(select min(id) from public.branch_inventory_movements) $$,
 '55000','branch_inventory_movements is immutable; insert a compensating movement instead','ledger is immutable');

insert into public.inventory_balances(shop_id,variant_id,stock_on_hand,reserved_quantity,damaged_quantity,reorder_level)
values('d3000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000002',4,0,0,1);
select is(
 (select bi.stock_on_hand::integer from public.branch_inventory bi join public.merchant_branches mb on mb.id=bi.branch_id
  where bi.variant_id='d5000000-0000-4000-8000-000000000002' and mb.migration_source='LEGACY_SHOP'),
 4,'legacy inventory is copied without loss');
select private.apply_inventory_delta(
 'd3000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000002',
 1,0,0,'STOCK_RECEIVED','SYSTEM','LEGACY_TEST',null,'sync',null);
select is(
 (select bi.stock_on_hand::integer from public.branch_inventory bi join public.merchant_branches mb on mb.id=bi.branch_id
  where bi.variant_id='d5000000-0000-4000-8000-000000000002' and mb.migration_source='LEGACY_SHOP'),
 5,'legacy updates remain mirrored');
select is(has_table_privilege('authenticated','public.branch_inventory','UPDATE'),false,'clients cannot directly mutate stock');

select * from finish();
rollback;
