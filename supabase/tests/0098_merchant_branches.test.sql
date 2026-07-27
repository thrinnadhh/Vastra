begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(25);

select is(
  (select string_agg(e.enumlabel, ',' order by e.enumsortorder)
   from pg_type t join pg_enum e on e.enumtypid=t.oid
   join pg_namespace n on n.oid=t.typnamespace
   where n.nspname='public' and t.typname='merchant_branch_type'),
  'PHYSICAL_STORE,CLOUD_SHOP','merchant branch types are defined');
select is(
  (select string_agg(e.enumlabel, ',' order by e.enumsortorder)
   from pg_type t join pg_enum e on e.enumtypid=t.oid
   join pg_namespace n on n.oid=t.typnamespace
   where n.nspname='public' and t.typname='merchant_branch_status'),
  'REGISTERED,VERIFICATION_PENDING,APPROVED,ACTIVE,PAUSED,SUSPENDED,CLOSED',
  'merchant branch lifecycle is defined');
select is(
  (select string_agg(e.enumlabel, ',' order by e.enumsortorder)
   from pg_type t join pg_enum e on e.enumtypid=t.oid
   join pg_namespace n on n.oid=t.typnamespace
   where n.nspname='public' and t.typname='branch_geography_status'),
  'REVIEW_REQUIRED,VERIFIED,REJECTED','branch geography states are defined');
select ok(to_regclass('public.merchant_branches') is not null,'merchant_branches exists');
select ok(to_regclass('public.merchant_branch_hours') is not null,'merchant_branch_hours exists');
select ok(to_regclass('public.branch_service_zones') is not null,'branch_service_zones exists');
select ok(to_regclass('public.branch_postal_serviceability') is not null,'branch_postal_serviceability exists');
select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public'
     and c.relname in ('merchant_branches','merchant_branch_hours','branch_service_zones','branch_postal_serviceability')
     and c.relrowsecurity),4,'branch tables enable RLS');
select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public'
     and c.relname in ('merchant_branches','merchant_branch_hours','branch_service_zones','branch_postal_serviceability')
     and c.relforcerowsecurity),4,'branch tables force RLS');

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('c1000000-0000-4000-8000-000000000001','authenticated','authenticated','branch-global@test.local',crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('c1000000-0000-4000-8000-000000000002','authenticated','authenticated','branch-city@test.local',crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('c1000000-0000-4000-8000-000000000010','authenticated','authenticated','branch-merchant@test.local',crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('c1000000-0000-4000-8000-000000000011','authenticated','authenticated','branch-other@test.local',crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('c1000000-0000-4000-8000-000000000020','authenticated','authenticated','branch-customer@test.local',crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.profiles(id,account_type,full_name,status) values
('c1000000-0000-4000-8000-000000000001','ADMIN','Branch Global','ACTIVE'),
('c1000000-0000-4000-8000-000000000002','ADMIN','Branch City','ACTIVE'),
('c1000000-0000-4000-8000-000000000010','MERCHANT','Branch Merchant','ACTIVE'),
('c1000000-0000-4000-8000-000000000011','MERCHANT','Branch Other','ACTIVE'),
('c1000000-0000-4000-8000-000000000020','CUSTOMER','Branch Customer','ACTIVE');

insert into public.admin_profiles(user_id,employee_code,department,two_factor_enabled,has_global_access) values
('c1000000-0000-4000-8000-000000000001','BR-GLOBAL','PLATFORM',true,true),
('c1000000-0000-4000-8000-000000000002','BR-CITY','OPERATIONS',true,false);
insert into public.merchant_profiles(user_id,legal_name,onboarding_status,kyc_status) values
('c1000000-0000-4000-8000-000000000010','Branch Merchant Legal','ACTIVE','VERIFIED'),
('c1000000-0000-4000-8000-000000000011','Branch Other Legal','ACTIVE','VERIFIED');

insert into public.addresses(
 id,user_id,label,recipient_name,phone_number,line1,area,city,state,postal_code,country_code,location
) values
('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000010','Tirupati','Merchant','9000000001','1 Road','Central','Tirupati','Andhra Pradesh','517501','IN','SRID=4326;POINT(79.4192 13.6288)'::extensions.geography),
('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000010','Bengaluru','Merchant','9000000002','2 Road','East','Bengaluru','Karnataka','560038','IN','SRID=4326;POINT(77.6408 12.9784)'::extensions.geography),
('c2000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000011','Other','Other','9000000003','3 Road','Central','Tirupati','Andhra Pradesh','517502','IN','SRID=4326;POINT(79.4300 13.6300)'::extensions.geography);

insert into public.cities(id,code,slug,name,state_code) values
('c6000000-0000-4000-8000-000000000001','BR_TIRUPATI','br-tirupati','Tirupati','AP'),
('c6000000-0000-4000-8000-000000000002','BR_BENGALURU','br-bengaluru','Bengaluru','KA');
update public.cities set status='CONFIGURING' where id in ('c6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002');
update public.cities set status='READY_FOR_VALIDATION' where id in ('c6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002');
update public.cities set status='ACTIVE' where id in ('c6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002');
insert into public.service_zones(id,city_id,code,slug,name) values
('c6100000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','BR_TIR_ZONE','br-tir-zone','Tirupati Zone'),
('c6100000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000002','BR_BLR_ZONE','br-blr-zone','Bengaluru Zone');
update public.service_zones set status='CONFIGURING' where id in ('c6100000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000002');
update public.service_zones set status='READY_FOR_VALIDATION' where id in ('c6100000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000002');
update public.service_zones set status='ACTIVE' where id in ('c6100000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000002');
insert into public.admin_city_assignments(admin_user_id,city_id,role,assigned_by,reason)
values('c1000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','CITY_ADMIN','c1000000-0000-4000-8000-000000000001','test');

insert into public.shops(
 id,merchant_id,address_id,shop_code,name,slug,phone_number,location,
 verification_status,operational_status,accepts_online_orders
) values
('c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000010','c2000000-0000-4000-8000-000000000001','BR-SHOP','Branch Shop','branch-shop','9100000001','SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,'VERIFIED','OPEN',true),
('c3000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000011','c2000000-0000-4000-8000-000000000003','BR-OTHER','Other Shop','branch-other','9100000002','SRID=4326;POINT(79.4300 13.6300)'::extensions.geography,'VERIFIED','OPEN',true);

select is((select count(*)::integer from public.merchant_branches where shop_id='c3000000-0000-4000-8000-000000000001' and migration_source='LEGACY_SHOP'),1,'shop creates one legacy branch');
select is((select geography_status::text from public.merchant_branches where shop_id='c3000000-0000-4000-8000-000000000001' and migration_source='LEGACY_SHOP'),'REVIEW_REQUIRED','legacy branch requires geography review');
select is((select local_delivery_enabled from public.merchant_branches where shop_id='c3000000-0000-4000-8000-000000000001' and migration_source='LEGACY_SHOP'),false,'legacy branch is not silently local-active');

insert into public.merchant_branches(
 id,shop_id,merchant_id,city_id,primary_service_zone_id,branch_code,name,branch_type,
 address_id,return_address_id,pincode,location,local_delivery_enabled,
 postal_delivery_enabled,all_india_postal_enabled,accepts_walk_in
) values
('c3100000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000010','c6000000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000001','BR-TIR','Tirupati Branch','PHYSICAL_STORE','c2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','517501','SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,true,false,false,true),
('c3100000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000010','c6000000-0000-4000-8000-000000000002','c6100000-0000-4000-8000-000000000002','BR-BLR','Bengaluru Cloud','CLOUD_SHOP','c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000002','560038','SRID=4326;POINT(77.6408 12.9784)'::extensions.geography,false,true,true,true),
('c3100000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000011','c6000000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000001','BR-OTHER-TIR','Other Branch','PHYSICAL_STORE','c2000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000003','517502','SRID=4326;POINT(79.4300 13.6300)'::extensions.geography,true,false,false,true);
insert into public.branch_service_zones(branch_id,city_id,service_zone_id,is_primary,is_active) values
('c3100000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000001',true,true),
('c3100000-0000-4000-8000-000000000003','c6000000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000001',true,true);
update public.merchant_branches set verification_status='VERIFIED',geography_status='VERIFIED',status='VERIFICATION_PENDING'
where id in ('c3100000-0000-4000-8000-000000000001','c3100000-0000-4000-8000-000000000002','c3100000-0000-4000-8000-000000000003');
update public.merchant_branches set status='APPROVED' where id in ('c3100000-0000-4000-8000-000000000001','c3100000-0000-4000-8000-000000000002','c3100000-0000-4000-8000-000000000003');
update public.merchant_branches set status='ACTIVE' where id in ('c3100000-0000-4000-8000-000000000001','c3100000-0000-4000-8000-000000000002','c3100000-0000-4000-8000-000000000003');

select is((select count(*)::integer from public.merchant_branches where merchant_id='c1000000-0000-4000-8000-000000000010' and status='ACTIVE'),2,'one merchant activates branches in two cities');
select is((select accepts_walk_in from public.merchant_branches where id='c3100000-0000-4000-8000-000000000002'),false,'cloud shop disables walk-in');
select is((select all_india_postal_enabled from public.merchant_branches where id='c3100000-0000-4000-8000-000000000002'),true,'cloud shop supports all-India postal');
select is((select count(*)::integer from information_schema.columns where table_schema='public' and table_name='merchant_branches' and column_name like '%price%'),0,'branch cannot override shared catalogue price');

update public.merchant_branches set status='PAUSED' where id='c3100000-0000-4000-8000-000000000001';
select is((select status::text from public.merchant_branches where id='c3100000-0000-4000-8000-000000000002'),'ACTIVE','pausing one branch leaves sibling active');
update public.merchant_branches set status='ACTIVE' where id='c3100000-0000-4000-8000-000000000001';
select throws_ok(
 $$ update public.merchant_branches set pincode='517599' where id='c3100000-0000-4000-8000-000000000001' $$,
 '23514','MERCHANT_BRANCH_GEOGRAPHY_CHANGE_REQUIRES_PAUSE','active geography changes require pause');

select is(has_table_privilege('authenticated','public.merchant_branches','INSERT'),false,'clients cannot directly insert branches');

set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000010',true);
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000010","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::integer from public.merchant_branches where merchant_id='c1000000-0000-4000-8000-000000000010'),3,'merchant reads own branches including migration branch');
select is((select count(*)::integer from public.merchant_branches where merchant_id='c1000000-0000-4000-8000-000000000011'),0,'merchant cannot read another merchant branches');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.merchant_branches where city_id='c6000000-0000-4000-8000-000000000001'),2,'city admin reads assigned-city branches');
select is((select count(*)::integer from public.merchant_branches where city_id='c6000000-0000-4000-8000-000000000002'),0,'city admin cannot read another city');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::integer from public.merchant_branches),0,'city admin fails closed without AAL2');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.merchant_branches),5,'global admin reads every branch');

reset role;
select * from finish();
rollback;
