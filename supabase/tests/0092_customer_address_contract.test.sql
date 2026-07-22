begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(21);
select has_function('public','list_customer_addresses',array[]::text[],'list RPC exists');
select has_function('public','get_customer_address',array['uuid'],'read RPC exists');
select has_function('public','create_customer_address',array['jsonb','uuid'],'create RPC exists');
select has_function('public','update_customer_address',array['uuid','jsonb','uuid'],'update RPC exists');
select has_function('public','delete_customer_address',array['uuid','uuid'],'delete RPC exists');
select has_function('public','set_customer_default_address',array['uuid','uuid'],'default RPC exists');
select ok(has_function_privilege('authenticated','public.list_customer_addresses()','EXECUTE'),'authenticated may list');
select ok(not has_function_privilege('anon','public.create_customer_address(jsonb,uuid)','EXECUTE'),'anonymous cannot create');
select ok(not has_table_privilege('authenticated','public.addresses','INSERT') and not has_table_privilege('authenticated','public.addresses','UPDATE') and not has_table_privilege('authenticated','public.addresses','DELETE'),'direct writes restricted');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a5100000-0000-4000-8000-000000000001','authenticated','authenticated','address-one@test',crypt('local',gen_salt('bf')),now(),'{}','{}',now(),now()),
('a5100000-0000-4000-8000-000000000002','authenticated','authenticated','address-two@test',crypt('local',gen_salt('bf')),now(),'{}','{}',now(),now()),
('a5100000-0000-4000-8000-000000000003','authenticated','authenticated','address-merchant@test',crypt('local',gen_salt('bf')),now(),'{}','{}',now(),now()),
('a5100000-0000-4000-8000-000000000004','authenticated','authenticated','address-blocked@test',crypt('local',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.profiles(id,account_type,full_name,status) values
('a5100000-0000-4000-8000-000000000001','CUSTOMER','Address One','ACTIVE'),
('a5100000-0000-4000-8000-000000000002','CUSTOMER','Address Two','ACTIVE'),
('a5100000-0000-4000-8000-000000000003','MERCHANT','Address Merchant','ACTIVE'),
('a5100000-0000-4000-8000-000000000004','CUSTOMER','Address Blocked','BLOCKED');
insert into public.customer_profiles(user_id) values ('a5100000-0000-4000-8000-000000000001'),('a5100000-0000-4000-8000-000000000002'),('a5100000-0000-4000-8000-000000000004');
insert into public.merchant_profiles(user_id,legal_name) values ('a5100000-0000-4000-8000-000000000003','Address Merchant Legal');
insert into public.addresses(id,user_id,recipient_name,phone_number,line1,area,city,state,postal_code,country_code,location) values ('a5200000-0000-4000-8000-000000000001','a5100000-0000-4000-8000-000000000003','Merchant','9000000003','Shop Road','Tirupati','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.4192 13.6288)'::extensions.geography);
insert into public.shops(id,merchant_id,address_id,shop_code,name,slug,phone_number,location,verification_status,operational_status,accepts_online_orders,service_radius_meters) values ('a5300000-0000-4000-8000-000000000001','a5100000-0000-4000-8000-000000000003','a5200000-0000-4000-8000-000000000001','ADDRESS-SHOP','Address Shop','address-shop','9000000003','SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,'VERIFIED','OPEN',true,5000);

set local role authenticated;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000001',true);
select lives_ok($$ select public.create_customer_address('{"label":"Home","recipientName":"One","phoneNumber":"9000000001","line1":"One Road","area":"Tirupati","city":"Tirupati","state":"Andhra Pradesh","postalCode":"517501","countryCode":"IN","latitude":13.6288,"longitude":79.4192,"isDefault":true}'::jsonb,'a5400000-0000-4000-8000-000000000001') $$,'customer creates address');
select is((select count(*)::integer from public.list_customer_addresses()),1,'customer lists one owned address');
select is((select address->>'serviceable' from public.list_customer_addresses()),'true','serviceability is server-derived');
select is((select address->>'isDefault' from public.list_customer_addresses()),'true','first address is default');
select throws_ok($$ select public.get_customer_address('a5200000-0000-4000-8000-000000000099') $$,'P0002','address not found','missing or foreign address is hidden');
select throws_ok($$ select public.create_customer_address('{"recipientName":"Bad","phoneNumber":"x","line1":"Road","area":"T","city":"T","state":"A","postalCode":"x","countryCode":"IN","latitude":91,"longitude":79}'::jsonb,'a5400000-0000-4000-8000-000000000002') $$,'22023',null,'invalid fields and coordinates rejected');
select lives_ok($$ select public.update_customer_address((select (address->>'id')::uuid from public.list_customer_addresses() limit 1),'{"label":"Office"}'::jsonb,'a5400000-0000-4000-8000-000000000003') $$,'customer updates owned address');
select lives_ok($$ select public.set_customer_default_address((select (address->>'id')::uuid from public.list_customer_addresses() limit 1),'a5400000-0000-4000-8000-000000000004') $$,'customer selects default deterministically');
select lives_ok($$ select public.delete_customer_address((select (address->>'id')::uuid from public.list_customer_addresses() limit 1),'a5400000-0000-4000-8000-000000000005') $$,'customer deletes owned address');
select is((select count(*)::integer from public.list_customer_addresses()),0,'deleted address is absent');
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000003',true);
select throws_ok($$ select public.list_customer_addresses() $$,'42501','active customer required','merchant rejected');
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000004',true);
select throws_ok($$ select public.list_customer_addresses() $$,'42501','active customer required','inactive customer rejected');
select * from finish();
rollback;
