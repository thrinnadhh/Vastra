begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select ok(to_regprocedure('public.start_order_dispatch(uuid,uuid)') is not null, 'dispatch RPC exists');
select is((select count(*) from pg_proc p where p.oid='public.start_order_dispatch(uuid,uuid)'::regprocedure and exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE')),0::bigint,'public cannot execute dispatch RPC');
select ok(not has_function_privilege('anon','public.start_order_dispatch(uuid,uuid)','EXECUTE'),'anon cannot execute dispatch RPC');
select ok(not has_function_privilege('authenticated','public.start_order_dispatch(uuid,uuid)','EXECUTE'),'authenticated cannot execute dispatch RPC');
select ok(has_function_privilege('service_role','public.start_order_dispatch(uuid,uuid)','EXECUTE'),'service role can execute dispatch RPC');
select ok(not has_table_privilege('anon','private.order_dispatch_requests','SELECT'),'anon cannot read receipts');
select ok(not has_table_privilege('authenticated','private.order_dispatch_requests','INSERT'),'authenticated cannot write receipts');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f1000000-0000-4000-8000-000000000001','authenticated','authenticated','dispatch-customer@example.test',crypt('local-test-only',gen_salt('bf')),now(),'{}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000002','authenticated','authenticated','dispatch-owner@example.test',crypt('local-test-only',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.profiles(id,account_type,full_name,status) values
('f1000000-0000-4000-8000-000000000001','CUSTOMER','Dispatch Customer','ACTIVE'),
('f1000000-0000-4000-8000-000000000002','MERCHANT','Dispatch Owner','ACTIVE');
insert into public.customer_profiles(user_id) values ('f1000000-0000-4000-8000-000000000001');
insert into public.merchant_profiles(user_id,legal_name) values ('f1000000-0000-4000-8000-000000000002','Dispatch Owner Legal');
insert into public.addresses(id,user_id,label,recipient_name,phone_number,line1,line2,landmark,area,city,state,postal_code,country_code,location) values
('f1100000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Home','Dispatch Customer','9000000501','Customer Street',null,'Near Park','Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.42 13.629)'::extensions.geography),
('f1100000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','Shop','Dispatch Owner','9000000502','Merchant Street','Floor 1','Near Temple','Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.419 13.628)'::extensions.geography),
('f1100000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000002','Shop','Deleted Shop','9000000503','Deleted Street',null,null,'Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.418 13.627)'::extensions.geography);
insert into public.shops(id,merchant_id,address_id,shop_code,name,slug,phone_number,location,verification_status,operational_status,accepts_online_orders,deleted_at) values
('f1200000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','f1100000-0000-4000-8000-000000000002','DISPATCH_MAIN','Dispatch Shop','dispatch-shop','9000000502','SRID=4326;POINT(79.419 13.628)'::extensions.geography,'VERIFIED','OPEN',true,null),
('f1200000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','f1100000-0000-4000-8000-000000000003','DISPATCH_DELETED','Deleted Dispatch Shop','deleted-dispatch-shop','9000000503','SRID=4326;POINT(79.418 13.627)'::extensions.geography,'VERIFIED','CLOSED_FOR_DAY',false,now());
insert into public.categories(id,name,slug) values ('f1300000-0000-4000-8000-000000000001','Dispatch','dispatch');
insert into public.products(id,shop_id,category_id,name,slug,moderation_status) values
('f1400000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001','Dispatch Kurta','dispatch-kurta','APPROVED'),
('f1400000-0000-4000-8000-000000000002','f1200000-0000-4000-8000-000000000002','f1300000-0000-4000-8000-000000000001','Deleted Kurta','deleted-kurta','APPROVED');
insert into public.product_variants(id,product_id,shop_id,sku,colour_name,size_label,mrp_paise,selling_price_paise) values
('f1500000-0000-4000-8000-000000000001','f1400000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','DISPATCH-M','Blue','M',10000,10000),
('f1500000-0000-4000-8000-000000000002','f1400000-0000-4000-8000-000000000002','f1200000-0000-4000-8000-000000000002','DELETED-M','Black','M',10000,10000);

create temporary table dispatch_snapshot as select jsonb_build_object(
  'id','f1100000-0000-4000-8000-000000000001','label','Home','recipientName','Dispatch Customer',
  'phoneNumber','9000000501','line1','Customer Street','line2',null,'landmark','Near Park',
  'area','Tirupati','city','Tirupati','state','Andhra Pradesh','postalCode','517501',
  'countryCode','IN','latitude',13.629,'longitude',79.42) value;

insert into public.orders(id,order_number,idempotency_key,customer_id,shop_id,delivery_address_id,address_snapshot,status,payment_status,fulfilment_type,subtotal_paise,delivery_fee_paise,total_paise,ready_at) values
('f1800000-0000-4000-8000-000000000001','DISPATCH-VALID','dispatch-valid','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001',(select value from dispatch_snapshot),'READY_FOR_PICKUP','COD_PENDING','DELIVERY',10000,499,10499,now()),
('f1800000-0000-4000-8000-000000000002','DISPATCH-OTHER','dispatch-other','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001',(select value from dispatch_snapshot),'READY_FOR_PICKUP','COD_PENDING','DELIVERY',10000,499,10499,now()),
('f1800000-0000-4000-8000-000000000003','DISPATCH-WRONG','dispatch-wrong','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001',(select value from dispatch_snapshot),'PACKING','COD_PENDING','DELIVERY',10000,499,10499,null),
('f1800000-0000-4000-8000-000000000004','DISPATCH-PICKUP','dispatch-pickup','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001',null,'{}','READY_FOR_PICKUP','COD_PENDING','CUSTOMER_PICKUP',10000,0,10000,now()),
('f1800000-0000-4000-8000-000000000005','DISPATCH-NOREADY','dispatch-noready','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001',(select value from dispatch_snapshot),'READY_FOR_PICKUP','COD_PENDING','DELIVERY',10000,499,10499,null),
('f1800000-0000-4000-8000-000000000006','DISPATCH-EMPTY','dispatch-empty','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001',(select value from dispatch_snapshot),'READY_FOR_PICKUP','COD_PENDING','DELIVERY',0,0,0,now()),
('f1800000-0000-4000-8000-000000000007','DISPATCH-PENDING','dispatch-pending','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001',(select value from dispatch_snapshot),'READY_FOR_PICKUP','COD_PENDING','DELIVERY',10000,499,10499,now()),
('f1800000-0000-4000-8000-000000000008','DISPATCH-BADDROP','dispatch-baddrop','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001','{"latitude":13.629}','READY_FOR_PICKUP','COD_PENDING','DELIVERY',10000,499,10499,now()),
('f1800000-0000-4000-8000-000000000009','DISPATCH-DELETED','dispatch-deleted','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000002','f1100000-0000-4000-8000-000000000001',(select value from dispatch_snapshot),'READY_FOR_PICKUP','COD_PENDING','DELIVERY',10000,499,10499,now()),
('f1800000-0000-4000-8000-000000000010','DISPATCH-INCONSISTENT','dispatch-inconsistent','f1000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001',(select value from dispatch_snapshot),'CAPTAIN_SEARCHING','COD_PENDING','DELIVERY',10000,499,10499,now());

insert into public.order_items(id,order_id,shop_id,product_id,variant_id,product_name_snapshot,sku_snapshot,quantity,unit_mrp_paise,unit_selling_price_paise,total_paise,fulfilment_status)
select ('f1900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  ('f1800000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  case when n=9 then 'f1200000-0000-4000-8000-000000000002'::uuid else 'f1200000-0000-4000-8000-000000000001'::uuid end,
  case when n=9 then 'f1400000-0000-4000-8000-000000000002'::uuid else 'f1400000-0000-4000-8000-000000000001'::uuid end,
  case when n=9 then 'f1500000-0000-4000-8000-000000000002'::uuid else 'f1500000-0000-4000-8000-000000000001'::uuid end,
  'Dispatch Kurta',case when n=9 then 'DELETED-M' else 'DISPATCH-M' end,1,10000,10000,10000,
  case when n=7 then 'PENDING'::public.order_item_fulfilment_status else 'PACKED'::public.order_item_fulfilment_status end
from generate_series(1,10) n where n<>6;

insert into public.delivery_tasks(id,order_id,task_type,pickup_shop_id,pickup_address_snapshot,drop_address_snapshot,pickup_location,drop_location,status,delivery_fee_paise,captain_earning_paise,scheduled_at)
values('f1a00000-0000-4000-8000-000000000010','f1800000-0000-4000-8000-000000000010','FORWARD_DELIVERY','f1200000-0000-4000-8000-000000000001','{}',(select value from dispatch_snapshot),'SRID=4326;POINT(79.419 13.628)'::extensions.geography,'SRID=4326;POINT(79.42 13.629)'::extensions.geography,'SEARCHING',499,0,now());

select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-999999999999','fa000000-0000-4000-8000-000000000001')$$,'P0029','order not found','nonexistent order is rejected');
select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-000000000003','fa000000-0000-4000-8000-000000000002')$$,'P0030','order state is not eligible for dispatch start','wrong state is rejected');
select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-000000000004','fa000000-0000-4000-8000-000000000003')$$,'P0031','customer pickup orders are not dispatch eligible','customer pickup is rejected');
select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-000000000005','fa000000-0000-4000-8000-000000000004')$$,'P0032','ready timestamp is missing','missing ready_at is rejected');
select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-000000000006','fa000000-0000-4000-8000-000000000005')$$,'P0032','dispatch order items are internally inconsistent','empty order is rejected');
select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-000000000007','fa000000-0000-4000-8000-000000000006')$$,'P0032','dispatch order items are internally inconsistent','unpacked item is rejected');
select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-000000000008','fa000000-0000-4000-8000-000000000007')$$,'P0032','drop snapshot is invalid','invalid drop snapshot is rejected');
select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-000000000009','fa000000-0000-4000-8000-000000000008')$$,'P0032','dispatch shop is unavailable','missing shop/address source is rejected');
select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-000000000010','fa000000-0000-4000-8000-000000000009')$$,'P0032','captain-search replay effects are inconsistent','inconsistent existing task is rejected');

create temporary table dispatch_result(value jsonb not null);
insert into dispatch_result values(public.start_order_dispatch('f1800000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000010'));
select is((select count(*) from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001' and task_type='FORWARD_DELIVERY'),1::bigint,'fresh order creates one forward task');
select is((select status::text from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001'),'SEARCHING','task starts searching');
select ok((select pickup_address_snapshot->>'shopName'='Dispatch Shop' and pickup_address_snapshot->>'line1'='Merchant Street' from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001'),'pickup snapshot is stored');
select is((select drop_address_snapshot from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001'),(select value from dispatch_snapshot),'drop snapshot is exact');
select ok((select extensions.st_equals(pickup_location::extensions.geometry,'SRID=4326;POINT(79.419 13.628)'::extensions.geometry) and extensions.st_equals(drop_location::extensions.geometry,'SRID=4326;POINT(79.42 13.629)'::extensions.geometry) from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001'),'pickup and drop geography are correct');
select is((select delivery_fee_paise from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001')::bigint,499::bigint,'delivery fee comes from order');
select is((select captain_earning_paise from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001')::bigint,0::bigint,'captain earning remains zero');
select is((select status::text from public.orders where id='f1800000-0000-4000-8000-000000000001'),'CAPTAIN_SEARCHING','order enters captain search');
select is((select changed_by_role::text from public.order_status_history where order_id='f1800000-0000-4000-8000-000000000001' and previous_status='READY_FOR_PICKUP' and new_status='CAPTAIN_SEARCHING'),'SYSTEM','transition actor is system');
select is((select count(*) from public.order_status_history where order_id='f1800000-0000-4000-8000-000000000001' and previous_status='READY_FOR_PICKUP' and new_status='CAPTAIN_SEARCHING'),1::bigint,'exactly one transition is recorded');
select is((select count(*) from public.outbox_events where event_type='delivery.task.search_started' and payload->>'orderId'='f1800000-0000-4000-8000-000000000001'),1::bigint,'exactly one search-start event is recorded');
select ok((select e.payload->>'deliveryTaskId'=t.id::text and e.payload->>'shopId'=t.pickup_shop_id::text and e.payload->>'orderId'=t.order_id::text from public.delivery_tasks t join public.outbox_events e on e.aggregate_id=t.id and e.event_type='delivery.task.search_started' where t.order_id='f1800000-0000-4000-8000-000000000001'),'event references task order and shop');
select is((select count(*) from public.delivery_assignments a join public.delivery_tasks t on t.id=a.delivery_task_id where t.order_id='f1800000-0000-4000-8000-000000000001'),0::bigint,'no assignment is created');
select ok((select pickup_code_hash is null and delivery_otp_hash is null from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001'),'no pickup code or delivery OTP is generated');
select is((select count(*) from public.cod_collections c join public.delivery_tasks t on t.id=c.delivery_task_id where t.order_id='f1800000-0000-4000-8000-000000000001'),0::bigint,'no COD collection is created');

create temporary table replay_result(value jsonb not null);
insert into replay_result values(public.start_order_dispatch('f1800000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000010'));
select is((select value->>'deliveryTaskId' from replay_result),(select value->>'deliveryTaskId' from dispatch_result),'same-key replay returns same task');
select is((select (value->>'replayed')::boolean from replay_result),true,'same-key replay reports replayed');
select is((select count(*) from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001'),1::bigint,'same-key replay creates no task duplicate');
select throws_ok($$select public.start_order_dispatch('f1800000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000010')$$,'P0028','idempotency key belongs to another dispatch request','same key with another order conflicts');

create temporary table convergence_result(value jsonb not null);
insert into convergence_result values(public.start_order_dispatch('f1800000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000011'));
select is((select value->>'deliveryTaskId' from convergence_result),(select value->>'deliveryTaskId' from dispatch_result),'different key converges on existing task');
select is((select (value->>'replayed')::boolean from convergence_result),true,'different key reports safe replay');
select ok((select count(*)=1 from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000001') and (select count(*)=1 from public.outbox_events where event_type='delivery.task.search_started' and payload->>'orderId'='f1800000-0000-4000-8000-000000000001'),'different-key convergence creates no duplicate effects');

select is((select count(*) from private.order_dispatch_requests where idempotency_key='fa000000-0000-4000-8000-000000000007'),0::bigint,'failed transaction rolls back receipt');
select is((select count(*) from public.delivery_tasks where order_id='f1800000-0000-4000-8000-000000000008'),0::bigint,'failed transaction rolls back task');
select is((select count(*) from public.order_status_history where order_id='f1800000-0000-4000-8000-000000000008' and new_status='CAPTAIN_SEARCHING'),0::bigint,'failed transaction rolls back transition');
select is((select count(*) from public.outbox_events where event_type='delivery.task.search_started' and payload->>'orderId'='f1800000-0000-4000-8000-000000000008'),0::bigint,'failed transaction rolls back event');
select throws_ok($$insert into public.delivery_tasks(order_id,task_type,pickup_shop_id,pickup_address_snapshot,drop_address_snapshot,pickup_location,drop_location,status) values('f1800000-0000-4000-8000-000000000001','FORWARD_DELIVERY','f1200000-0000-4000-8000-000000000001','{}',(select value from dispatch_snapshot),'SRID=4326;POINT(79.419 13.628)'::extensions.geography,'SRID=4326;POINT(79.42 13.629)'::extensions.geography,'CREATED')$$,'23505',null,'active forward-task uniqueness remains enforced');

select * from finish();
rollback;
