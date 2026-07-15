begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.mark_merchant_order_ready_for_pickup(uuid,uuid,uuid)') is not null, 'ready RPC exists');
select ok(not has_function_privilege('anon','public.mark_merchant_order_ready_for_pickup(uuid,uuid,uuid)','EXECUTE'),'anon cannot execute ready RPC');
select ok(not has_function_privilege('authenticated','public.mark_merchant_order_ready_for_pickup(uuid,uuid,uuid)','EXECUTE'),'authenticated cannot execute ready RPC directly');
select ok(has_function_privilege('service_role','public.mark_merchant_order_ready_for_pickup(uuid,uuid,uuid)','EXECUTE'),'service role can execute ready RPC');

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('e1000000-0000-4000-8000-000000000001','authenticated','authenticated','ready-customer@example.test',crypt('local-test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('e1000000-0000-4000-8000-000000000002','authenticated','authenticated','ready-owner@example.test',crypt('local-test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('e1000000-0000-4000-8000-000000000003','authenticated','authenticated','ready-other@example.test',crypt('local-test-only',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.profiles(id,account_type,full_name,status) values
('e1000000-0000-4000-8000-000000000001','CUSTOMER','Ready Customer','ACTIVE'),
('e1000000-0000-4000-8000-000000000002','MERCHANT','Ready Owner','ACTIVE'),
('e1000000-0000-4000-8000-000000000003','MERCHANT','Ready Other','ACTIVE');
insert into public.customer_profiles(user_id) values ('e1000000-0000-4000-8000-000000000001');
insert into public.merchant_profiles(user_id,legal_name) values
('e1000000-0000-4000-8000-000000000002','Ready Owner Legal'),
('e1000000-0000-4000-8000-000000000003','Ready Other Legal');
insert into public.addresses(id,user_id,label,recipient_name,phone_number,line1,area,city,state,postal_code,country_code,location) values
('e1100000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Home','Ready Customer','9000000401','Customer Street','Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.42 13.629)'::extensions.geography),
('e1100000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002','Shop','Ready Owner','9000000402','Owner Street','Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.419 13.628)'::extensions.geography),
('e1100000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000003','Shop','Ready Other','9000000403','Other Street','Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.421 13.630)'::extensions.geography);
insert into public.shops(id,merchant_id,address_id,shop_code,name,slug,phone_number,location,verification_status,operational_status,accepts_online_orders) values
('e1200000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','e1100000-0000-4000-8000-000000000002','READY_OWNER','Ready Owner Shop','ready-owner-shop','9000000402','SRID=4326;POINT(79.419 13.628)'::extensions.geography,'VERIFIED','OPEN',true),
('e1200000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003','e1100000-0000-4000-8000-000000000003','READY_OTHER','Ready Other Shop','ready-other-shop','9000000403','SRID=4326;POINT(79.421 13.630)'::extensions.geography,'VERIFIED','OPEN',true);
insert into public.categories(id,name,slug) values ('e1300000-0000-4000-8000-000000000001','Ready','ready');
insert into public.products(id,shop_id,category_id,name,slug,moderation_status) values
('e1400000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000001','Ready Kurta','ready-kurta','APPROVED'),
('e1400000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000002','e1300000-0000-4000-8000-000000000001','Other Ready Kurta','other-ready-kurta','APPROVED');
insert into public.product_variants(id,product_id,shop_id,sku,colour_name,size_label,mrp_paise,selling_price_paise) values
('e1500000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','READY-M','Blue','M',10000,10000),
('e1500000-0000-4000-8000-000000000002','e1400000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','READY-L','Blue','L',10000,10000),
('e1500000-0000-4000-8000-000000000003','e1400000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000002','OTHER-M','Black','M',10000,10000);
insert into public.carts(id,customer_id,shop_id,status)
select ('e1700000-0000-4000-8000-' || lpad(value::text,12,'0'))::uuid,'e1000000-0000-4000-8000-000000000001',case when value=9 then 'e1200000-0000-4000-8000-000000000002'::uuid else 'e1200000-0000-4000-8000-000000000001'::uuid end,'CONVERTED'
from generate_series(1,9) value;
insert into public.orders(id,order_number,idempotency_key,customer_id,shop_id,cart_id,delivery_address_id,address_snapshot,status,payment_status,fulfilment_type,subtotal_paise,total_paise) values
('e1800000-0000-4000-8000-000000000001','READY-PENDING','ready-pending','e1000000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1700000-0000-4000-8000-000000000001','e1100000-0000-4000-8000-000000000001','{}','PACKING','COD_PENDING','DELIVERY',20000,20000),
('e1800000-0000-4000-8000-000000000002','READY-EMPTY','ready-empty','e1000000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1700000-0000-4000-8000-000000000002','e1100000-0000-4000-8000-000000000001','{}','PACKING','COD_PENDING','DELIVERY',0,0),
('e1800000-0000-4000-8000-000000000003','READY-PARTIAL','ready-partial','e1000000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1700000-0000-4000-8000-000000000003','e1100000-0000-4000-8000-000000000001','{}','PACKING','COD_PENDING','DELIVERY',20000,20000),
('e1800000-0000-4000-8000-000000000004','READY-VALID','ready-valid','e1000000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1700000-0000-4000-8000-000000000004','e1100000-0000-4000-8000-000000000001','{}','PACKING','COD_PENDING','DELIVERY',20000,20000),
('e1800000-0000-4000-8000-000000000005','READY-WAITING','ready-waiting','e1000000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1700000-0000-4000-8000-000000000005','e1100000-0000-4000-8000-000000000001','{}','WAITING_FOR_MERCHANT','COD_PENDING','DELIVERY',0,0),
('e1800000-0000-4000-8000-000000000006','READY-CANCELLED','ready-cancelled','e1000000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1700000-0000-4000-8000-000000000006','e1100000-0000-4000-8000-000000000001','{}','WAITING_FOR_MERCHANT','COD_PENDING','DELIVERY',0,0),
('e1800000-0000-4000-8000-000000000007','READY-PROBLEM','ready-problem','e1000000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1700000-0000-4000-8000-000000000007','e1100000-0000-4000-8000-000000000001','{}','PROBLEM_REPORTED','COD_PENDING','DELIVERY',10000,10000),
('e1800000-0000-4000-8000-000000000008','READY-INCONSISTENT','ready-inconsistent','e1000000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1700000-0000-4000-8000-000000000008','e1100000-0000-4000-8000-000000000001','{}','READY_FOR_PICKUP','COD_PENDING','DELIVERY',10000,10000),
('e1800000-0000-4000-8000-000000000009','READY-OTHER','ready-other','e1000000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000002','e1700000-0000-4000-8000-000000000009','e1100000-0000-4000-8000-000000000001','{}','PACKING','COD_PENDING','DELIVERY',10000,10000);
select private.transition_order_state('e1800000-0000-4000-8000-000000000006','CANCELLED','e1000000-0000-4000-8000-000000000002','MERCHANT','TEST_CANCELLED','Cancelled-state fixture');

insert into public.order_items(id,order_id,shop_id,product_id,variant_id,product_name_snapshot,sku_snapshot,quantity,unit_mrp_paise,unit_selling_price_paise,total_paise,fulfilment_status) values
('e1900000-0000-4000-8000-000000000001','e1800000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000001','Ready Kurta','READY-M',1,10000,10000,10000,'PENDING'),
('e1900000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000002','Ready Kurta','READY-L',1,10000,10000,10000,'PENDING'),
('e1900000-0000-4000-8000-000000000003','e1800000-0000-4000-8000-000000000003','e1200000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000001','Ready Kurta','READY-M',1,10000,10000,10000,'VERIFIED'),
('e1900000-0000-4000-8000-000000000004','e1800000-0000-4000-8000-000000000003','e1200000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000002','Ready Kurta','READY-L',1,10000,10000,10000,'PENDING'),
('e1900000-0000-4000-8000-000000000005','e1800000-0000-4000-8000-000000000004','e1200000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000001','Ready Kurta','READY-M',1,10000,10000,10000,'VERIFIED'),
('e1900000-0000-4000-8000-000000000006','e1800000-0000-4000-8000-000000000004','e1200000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000002','Ready Kurta','READY-L',1,10000,10000,10000,'VERIFIED'),
('e1900000-0000-4000-8000-000000000007','e1800000-0000-4000-8000-000000000007','e1200000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000001','Ready Kurta','READY-M',1,10000,10000,10000,'PENDING'),
('e1900000-0000-4000-8000-000000000008','e1800000-0000-4000-8000-000000000008','e1200000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000001','Ready Kurta','READY-M',1,10000,10000,10000,'PACKED'),
('e1900000-0000-4000-8000-000000000009','e1800000-0000-4000-8000-000000000009','e1200000-0000-4000-8000-000000000002','e1400000-0000-4000-8000-000000000002','e1500000-0000-4000-8000-000000000003','Other Ready Kurta','OTHER-M',1,10000,10000,10000,'PENDING');
insert into public.order_item_verifications(order_item_id,verification_method,scanned_barcode,verified_variant_id,result,verified_by) values
('e1900000-0000-4000-8000-000000000002','BARCODE','WRONG-READY','e1500000-0000-4000-8000-000000000001','MISMATCH','e1000000-0000-4000-8000-000000000002'),
('e1900000-0000-4000-8000-000000000003','MANUAL',null,'e1500000-0000-4000-8000-000000000001','MATCH','e1000000-0000-4000-8000-000000000002'),
('e1900000-0000-4000-8000-000000000005','MANUAL',null,'e1500000-0000-4000-8000-000000000001','MATCH','e1000000-0000-4000-8000-000000000002'),
('e1900000-0000-4000-8000-000000000006','MANUAL',null,'e1500000-0000-4000-8000-000000000002','MATCH','e1000000-0000-4000-8000-000000000002'),
('e1900000-0000-4000-8000-000000000008','MANUAL',null,'e1500000-0000-4000-8000-000000000001','MATCH','e1000000-0000-4000-8000-000000000002');

select throws_ok($$select public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000003','e1800000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001')$$,'P0024','merchant order not found','another merchant cannot access the order');
select throws_ok($$select public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000002')$$,'P0026','merchant order has no item lines','empty order cannot become ready');

create temporary table ready_before as
select o.status,o.ready_at,o.version,
  (select count(*) from public.order_status_history h where h.order_id=o.id) history_count,
  (select count(*) from public.outbox_events e where e.aggregate_id=o.id and e.event_type='order.merchant.ready_for_pickup') event_count
from public.orders o where o.id='e1800000-0000-4000-8000-000000000001';
select throws_ok($$select public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000003')$$,'P0026','one or more merchant order items are not verified','pending and mismatch-only lines are rejected');
select is((select status::text from public.orders where id='e1800000-0000-4000-8000-000000000001'),'PACKING','failure leaves order packing');
select is((select ready_at from public.orders where id='e1800000-0000-4000-8000-000000000001'),null::timestamptz,'failure leaves ready_at null');
select is((select count(*) from public.order_status_history where order_id='e1800000-0000-4000-8000-000000000001'),(select history_count from ready_before),'failure creates no history');
select is((select count(*) from public.outbox_events where aggregate_id='e1800000-0000-4000-8000-000000000001' and event_type='order.merchant.ready_for_pickup'),0::bigint,'failure creates no ready event');
select is((select count(*) from public.order_items where order_id='e1800000-0000-4000-8000-000000000001' and fulfilment_status='PACKED'),0::bigint,'failure packs no item');
select throws_ok($$select public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000003','ea000000-0000-4000-8000-000000000004')$$,'P0026','one or more merchant order items are not verified','partial verification is rejected');

create temporary table ready_result(value jsonb not null);
insert into ready_result values(public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000004','ea000000-0000-4000-8000-000000000005'));
select is((select status::text from public.orders where id='e1800000-0000-4000-8000-000000000004'),'READY_FOR_PICKUP','valid order becomes ready');
select ok((select ready_at is not null from public.orders where id='e1800000-0000-4000-8000-000000000004'),'ready_at is populated');
select is((select count(*) from public.order_items where order_id='e1800000-0000-4000-8000-000000000004' and fulfilment_status='PACKED'),2::bigint,'every qualifying line is packed');
select is((select count(*) from public.order_status_history where order_id='e1800000-0000-4000-8000-000000000004' and previous_status='PACKING' and new_status='READY_FOR_PICKUP'),1::bigint,'one ready transition is recorded');
select is((select count(*) from public.outbox_events where aggregate_id='e1800000-0000-4000-8000-000000000004' and event_type='order.merchant.ready_for_pickup'),1::bigint,'one ready event is recorded');
select is((select (value->>'totalLines')::integer from ready_result),2,'response total is correct');
select is((select (value->>'packedLines')::integer from ready_result),2,'response packed count is correct');
select is((select (value->>'allPacked')::boolean from ready_result),true,'response confirms all packed');

create temporary table ready_snapshot as select ready_at,version from public.orders where id='e1800000-0000-4000-8000-000000000004';
select is((public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000004','ea000000-0000-4000-8000-000000000006')->>'replayed')::boolean,true,'different valid key safely replays');
select is((select count(*) from public.order_status_history where order_id='e1800000-0000-4000-8000-000000000004' and previous_status='PACKING' and new_status='READY_FOR_PICKUP'),1::bigint,'replay does not duplicate history');
select is((select count(*) from public.outbox_events where aggregate_id='e1800000-0000-4000-8000-000000000004' and event_type='order.merchant.ready_for_pickup'),1::bigint,'replay does not duplicate event');
select is((select ready_at from public.orders where id='e1800000-0000-4000-8000-000000000004'),(select ready_at from ready_snapshot),'replay preserves ready_at');
select is((select version from public.orders where id='e1800000-0000-4000-8000-000000000004'),(select version from ready_snapshot),'replay preserves version');
select is((public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000004','ea000000-0000-4000-8000-000000000007')->>'replayed')::boolean,true,'competing serialized caller observes replay');
select is((select count(*) from public.outbox_events where aggregate_id='e1800000-0000-4000-8000-000000000004' and event_type='order.merchant.ready_for_pickup'),1::bigint,'serialized callers cannot duplicate the event');

select throws_ok($$select public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000005','ea000000-0000-4000-8000-000000000008')$$,'P0025','merchant order state invalid for pickup readiness','pre-packing state is rejected');
select throws_ok($$select public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000006','ea000000-0000-4000-8000-000000000009')$$,'P0025','merchant order state invalid for pickup readiness','cancelled order is rejected');
select throws_ok($$select public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000007','ea000000-0000-4000-8000-000000000010')$$,'P0025','merchant order state invalid for pickup readiness','problem order is rejected');
select throws_ok($$select public.mark_merchant_order_ready_for_pickup('e1000000-0000-4000-8000-000000000002','e1800000-0000-4000-8000-000000000008','ea000000-0000-4000-8000-000000000011')$$,'P0027','ready-for-pickup replay state is internally inconsistent','inconsistent already-ready data is rejected');
select is((select count(*) from public.delivery_tasks where order_id='e1800000-0000-4000-8000-000000000004'),0::bigint,'ready command creates no delivery task');
select is((select status::text from public.orders where id='e1800000-0000-4000-8000-000000000004'),'READY_FOR_PICKUP','ready command does not enter captain search');

select * from finish();
rollback;
