begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.start_merchant_order_packing(uuid,uuid)') is not null, 'start-packing RPC exists');
select ok(to_regprocedure('public.get_merchant_order_packing_list(uuid,uuid)') is not null, 'packing-list RPC exists');
select ok(to_regprocedure('public.verify_merchant_order_item(uuid,uuid,uuid,text,text)') is not null, 'item-verification RPC exists');

select ok(not has_function_privilege('anon', 'public.start_merchant_order_packing(uuid,uuid)', 'EXECUTE'), 'anon cannot start packing');
select ok(not has_function_privilege('authenticated', 'public.start_merchant_order_packing(uuid,uuid)', 'EXECUTE'), 'authenticated cannot start packing directly');
select ok(has_function_privilege('service_role', 'public.start_merchant_order_packing(uuid,uuid)', 'EXECUTE'), 'service role can start packing');
select ok(not has_function_privilege('anon', 'public.get_merchant_order_packing_list(uuid,uuid)', 'EXECUTE'), 'anon cannot read packing list');
select ok(not has_function_privilege('authenticated', 'public.get_merchant_order_packing_list(uuid,uuid)', 'EXECUTE'), 'authenticated cannot call packing list directly');
select ok(has_function_privilege('service_role', 'public.get_merchant_order_packing_list(uuid,uuid)', 'EXECUTE'), 'service role can read packing list');
select ok(not has_function_privilege('anon', 'public.verify_merchant_order_item(uuid,uuid,uuid,text,text)', 'EXECUTE'), 'anon cannot verify items');
select ok(not has_function_privilege('authenticated', 'public.verify_merchant_order_item(uuid,uuid,uuid,text,text)', 'EXECUTE'), 'authenticated cannot verify items directly');
select ok(has_function_privilege('service_role', 'public.verify_merchant_order_item(uuid,uuid,uuid,text,text)', 'EXECUTE'), 'service role can verify items');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('f1000000-0000-4000-8000-000000000001','authenticated','authenticated','pack-customer@example.test',crypt('local-test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000002','authenticated','authenticated','pack-owner@example.test',crypt('local-test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000003','authenticated','authenticated','pack-other@example.test',crypt('local-test-only',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.profiles (id, account_type, full_name, status) values
('f1000000-0000-4000-8000-000000000001','CUSTOMER','Packing Customer','ACTIVE'),
('f1000000-0000-4000-8000-000000000002','MERCHANT','Packing Owner','ACTIVE'),
('f1000000-0000-4000-8000-000000000003','MERCHANT','Packing Other','ACTIVE');
insert into public.customer_profiles (user_id) values ('f1000000-0000-4000-8000-000000000001');
insert into public.merchant_profiles (user_id, legal_name) values
('f1000000-0000-4000-8000-000000000002','Packing Owner Legal'),
('f1000000-0000-4000-8000-000000000003','Packing Other Legal');

insert into public.addresses (id,user_id,label,recipient_name,phone_number,line1,area,city,state,postal_code,country_code,location) values
('f1100000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Home','Packing Customer','9000000301','Customer Street','Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.42 13.629)'::extensions.geography),
('f1100000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','Shop','Packing Owner','9000000302','Owner Street','Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.419 13.628)'::extensions.geography),
('f1100000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003','Shop','Packing Other','9000000303','Other Street','Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.421 13.630)'::extensions.geography);

insert into public.shops (id,merchant_id,address_id,shop_code,name,slug,phone_number,location,verification_status,operational_status,accepts_online_orders) values
('f1200000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','f1100000-0000-4000-8000-000000000002','PACK_OWNER','Packing Owner Shop','packing-owner-shop','9000000302','SRID=4326;POINT(79.419 13.628)'::extensions.geography,'VERIFIED','OPEN',true),
('f1200000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000003','f1100000-0000-4000-8000-000000000003','PACK_OTHER','Packing Other Shop','packing-other-shop','9000000303','SRID=4326;POINT(79.421 13.630)'::extensions.geography,'VERIFIED','OPEN',true);

insert into public.categories (id,name,slug) values ('f1300000-0000-4000-8000-000000000001','Packing','packing');
insert into public.products (id,shop_id,category_id,name,slug,moderation_status) values
('f1400000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001','Packing Kurta','packing-kurta','APPROVED'),
('f1400000-0000-4000-8000-000000000002','f1200000-0000-4000-8000-000000000002','f1300000-0000-4000-8000-000000000001','Other Kurta','other-kurta','APPROVED');
insert into public.product_variants (id,product_id,shop_id,sku,colour_name,size_label,mrp_paise,selling_price_paise) values
('f1500000-0000-4000-8000-000000000001','f1400000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','PACK-BLUE-M','Blue','M',10000,10000),
('f1500000-0000-4000-8000-000000000002','f1400000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','PACK-BLUE-L','Blue','L',10000,10000),
('f1500000-0000-4000-8000-000000000003','f1400000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','PACK-RED-M','Red','M',10000,10000),
('f1500000-0000-4000-8000-000000000004','f1400000-0000-4000-8000-000000000002','f1200000-0000-4000-8000-000000000002','OTHER-M','Black','M',10000,10000);
insert into public.variant_barcodes (id,variant_id,barcode_value) values
('f1600000-0000-4000-8000-000000000001','f1500000-0000-4000-8000-000000000001','CASE-Sensitive-1'),
('f1600000-0000-4000-8000-000000000002','f1500000-0000-4000-8000-000000000002','CORRECT-2'),
('f1600000-0000-4000-8000-000000000003','f1500000-0000-4000-8000-000000000003','WRONG-3');

insert into public.carts (id,customer_id,shop_id,status) values
('f1700000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','CONVERTED'),
('f1700000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','CONVERTED'),
('f1700000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000002','CONVERTED');

insert into public.orders (id,order_number,idempotency_key,customer_id,shop_id,cart_id,delivery_address_id,address_snapshot,status,payment_status,fulfilment_type,subtotal_paise,total_paise) values
('f1800000-0000-4000-8000-000000000001','PACKING-ORDER','packing-order-key','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1700000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001','{}','MERCHANT_ACCEPTED','COD_PENDING','DELIVERY',20000,20000),
('f1800000-0000-4000-8000-000000000002','PACKING-INVALID','packing-invalid-key','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1700000-0000-4000-8000-000000000002','f1100000-0000-4000-8000-000000000001','{}','WAITING_FOR_MERCHANT','COD_PENDING','DELIVERY',0,0),
('f1800000-0000-4000-8000-000000000003','PACKING-OTHER','packing-other-key','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000002','f1700000-0000-4000-8000-000000000003','f1100000-0000-4000-8000-000000000001','{}','MERCHANT_ACCEPTED','COD_PENDING','DELIVERY',10000,10000);

insert into public.order_items (id,order_id,shop_id,product_id,variant_id,product_name_snapshot,sku_snapshot,colour_snapshot,size_snapshot,image_object_key_snapshot,quantity,unit_mrp_paise,unit_selling_price_paise,total_paise,created_at) values
('f1900000-0000-4000-8000-000000000001','f1800000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1400000-0000-4000-8000-000000000001','f1500000-0000-4000-8000-000000000001','Packing Kurta','PACK-BLUE-M','Blue','M','products/pack-m.webp',1,10000,10000,10000,'2026-07-16T03:30:00Z'),
('f1900000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1400000-0000-4000-8000-000000000001','f1500000-0000-4000-8000-000000000002','Packing Kurta','PACK-BLUE-L','Blue','L','products/pack-l.webp',1,10000,10000,10000,'2026-07-16T03:30:00Z'),
('f1900000-0000-4000-8000-000000000003','f1800000-0000-4000-8000-000000000003','f1200000-0000-4000-8000-000000000002','f1400000-0000-4000-8000-000000000002','f1500000-0000-4000-8000-000000000004','Other Kurta','OTHER-M','Black','M',null,1,10000,10000,10000,'2026-07-16T03:30:00Z');

select throws_ok($$select public.start_merchant_order_packing('f1000000-0000-4000-8000-000000000003','f1800000-0000-4000-8000-000000000001')$$,'P0021','merchant order not found','merchant cannot start another shop order');
select is((public.start_merchant_order_packing('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001')->>'status'),'PACKING','accepted order starts packing');
select is((select count(*)::integer from public.order_status_history where order_id='f1800000-0000-4000-8000-000000000001' and new_status='PACKING'),1,'start packing writes one history row');
select is((select count(*)::integer from public.outbox_events where aggregate_id='f1800000-0000-4000-8000-000000000001' and event_type='order.merchant.packing.started'),1,'start packing writes one packing event');
select is((public.start_merchant_order_packing('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001')->>'replayed')::boolean,true,'start packing replays');
select is((select count(*)::integer from public.order_status_history where order_id='f1800000-0000-4000-8000-000000000001' and new_status='PACKING'),1,'replay does not duplicate history');
select is((select count(*)::integer from public.outbox_events where aggregate_id='f1800000-0000-4000-8000-000000000001' and event_type='order.merchant.packing.started'),1,'replay does not duplicate packing event');
select throws_ok($$select public.start_merchant_order_packing('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000002')$$,'P0022','merchant order state invalid for packing','invalid start state is rejected');

create temporary table packing_state (key text primary key, value jsonb not null);
insert into packing_state values ('list',public.get_merchant_order_packing_list('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001'));
select is((select (value->>'totalLines')::integer from packing_state where key='list'),2,'packing list contains every line');
select is((select value->'items'->0->>'orderItemId' from packing_state where key='list'),'f1900000-0000-4000-8000-000000000001','packing list ordering uses creation time and id');
select is((select (value->>'verifiedLines')::integer from packing_state where key='list'),0,'packing list starts unverified');
select throws_ok($$select public.get_merchant_order_packing_list('f1000000-0000-4000-8000-000000000003','f1800000-0000-4000-8000-000000000001')$$,'P0021','merchant order not found','packing list hides another merchant order');

insert into packing_state values ('manual',public.verify_merchant_order_item('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001','f1900000-0000-4000-8000-000000000001','MANUAL',null));
select is((select value->>'result' from packing_state where key='manual'),'MATCH','manual verification matches ordered variant');
select is((select fulfilment_status::text from public.order_items where id='f1900000-0000-4000-8000-000000000001'),'VERIFIED','successful verification marks line verified');
select is((select (value->>'verifiedLines')::integer from packing_state where key='manual'),1,'progress counts verified lines');
select is((public.verify_merchant_order_item('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001','f1900000-0000-4000-8000-000000000001','MANUAL',null)->>'replayed')::boolean,true,'identical successful verification replays');
select is((select count(*)::integer from public.order_item_verifications where order_item_id='f1900000-0000-4000-8000-000000000001'),1,'successful replay does not duplicate evidence');
select is((select count(*)::integer from public.outbox_events where event_type='order.item.verified' and payload->>'orderItemId'='f1900000-0000-4000-8000-000000000001'),1,'successful replay does not duplicate event');
select throws_ok($$select public.verify_merchant_order_item('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001','f1900000-0000-4000-8000-000000000001','BARCODE','CASE-Sensitive-1')$$,'P0023','successful verification command conflicts with stored evidence','conflicting successful replay is rejected');

insert into packing_state values ('wrong',public.verify_merchant_order_item('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001','f1900000-0000-4000-8000-000000000002','BARCODE','WRONG-3'));
select is((select value->>'result' from packing_state where key='wrong'),'MISMATCH','wrong-variant barcode records mismatch');
select is((select fulfilment_status::text from public.order_items where id='f1900000-0000-4000-8000-000000000002'),'PENDING','mismatch does not verify line');
select is((public.verify_merchant_order_item('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001','f1900000-0000-4000-8000-000000000002','BARCODE','WRONG-3')->>'replayed')::boolean,true,'mismatch replay is idempotent');
insert into packing_state values ('unknown',public.verify_merchant_order_item('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001','f1900000-0000-4000-8000-000000000002','BARCODE','UNKNOWN-2'));
select is((select value->>'result' from packing_state where key='unknown'),'MISMATCH','unknown barcode records mismatch');
select is((select count(*)::integer from public.outbox_events where event_type='order.item.verification_mismatch' and payload->>'orderItemId'='f1900000-0000-4000-8000-000000000002'),2,'distinct mismatches emit one event each');
insert into packing_state values ('correct',public.verify_merchant_order_item('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001','f1900000-0000-4000-8000-000000000002','BARCODE','CORRECT-2'));
select is((select value->>'result' from packing_state where key='correct'),'MATCH','correct barcode succeeds');
select is((select (value->>'verifiedLines')::integer from packing_state where key='correct'),2,'all lines count as verified after success');
select is((select (value->>'allVerified')::boolean from packing_state where key='correct'),true,'allVerified becomes true only after all lines succeed');
select is((select status::text from public.orders where id='f1800000-0000-4000-8000-000000000001'),'PACKING','all verified does not advance order');
select throws_ok($$select public.verify_merchant_order_item('f1000000-0000-4000-8000-000000000002','f1800000-0000-4000-8000-000000000001','f1900000-0000-4000-8000-000000000003','MANUAL',null)$$,'P0021','merchant order item not found','item from another order cannot be verified');
select throws_ok($$insert into public.order_item_verifications(order_item_id,verification_method,verified_variant_id,result,verified_by) values ('f1900000-0000-4000-8000-000000000001','MANUAL','f1500000-0000-4000-8000-000000000001','MATCH','f1000000-0000-4000-8000-000000000002')$$,'23505',null,'successful uniqueness prevents concurrent duplicate success');

select * from finish();
rollback;
