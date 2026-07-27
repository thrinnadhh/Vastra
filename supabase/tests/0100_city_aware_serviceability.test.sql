begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select is(
  (select string_agg(e.enumlabel, ',' order by e.enumsortorder)
   from pg_type t
   join pg_enum e on e.enumtypid = t.oid
   join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and t.typname = 'fulfilment_mode'),
  'LOCAL_DELIVERY,POSTAL_DELIVERY',
  'fulfilment modes are defined'
);
select ok(
  to_regclass('private.variant_serviceability_quotes') is not null,
  'private serviceability quote snapshots exist'
);
select ok(
  to_regprocedure(
    'public.resolve_customer_service_area(double precision,double precision,text)'
  ) is not null,
  'service area resolver exists'
);
select ok(
  to_regprocedure(
    'public.get_variant_serviceability_quote(uuid,integer,double precision,double precision,text)'
  ) is not null,
  'variant serviceability quote exists'
);
select ok(
  to_regprocedure(
    'public.revalidate_serviceability_quote(uuid,uuid,integer)'
  ) is not null,
  'quote revalidation exists'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.variant_serviceability_quotes',
    'SELECT'
  ),
  'authenticated clients cannot read private quote snapshots'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_variant_serviceability_quote(uuid,integer,double precision,double precision,text)',
    'EXECUTE'
  ),
  'authenticated clients can request a quote'
);

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('e1000000-0000-4000-8000-000000000001','authenticated','authenticated',
 'svc-merchant@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now()),
('e1000000-0000-4000-8000-000000000002','authenticated','authenticated',
 'svc-customer@test.local',crypt('test',gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.profiles(id,account_type,full_name,status) values
('e1000000-0000-4000-8000-000000000001','MERCHANT','Service Merchant','ACTIVE'),
('e1000000-0000-4000-8000-000000000002','CUSTOMER','Service Customer','ACTIVE');
insert into public.merchant_profiles(
  user_id,legal_name,onboarding_status,kyc_status
) values (
  'e1000000-0000-4000-8000-000000000001',
  'Service Merchant Legal','ACTIVE','VERIFIED'
);
insert into public.customer_profiles(user_id) values
('e1000000-0000-4000-8000-000000000002');

insert into public.addresses(
  id,user_id,label,recipient_name,phone_number,line1,area,city,state,
  postal_code,country_code,location
) values
('e2000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000001',
 'Tirupati','Merchant','9000000201','1 Road','Central','Tirupati',
 'Andhra Pradesh','517501','IN',
 'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography),
('e2000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000001',
 'Bengaluru','Merchant','9000000202','2 Road','East','Bengaluru',
 'Karnataka','560038','IN',
 'SRID=4326;POINT(77.6408 12.9784)'::extensions.geography);

insert into public.cities(id,code,slug,name,state_code) values
('e6000000-0000-4000-8000-000000000001',
 'SVC_TIRUPATI','svc-tirupati','Tirupati','AP'),
('e6000000-0000-4000-8000-000000000002',
 'SVC_BENGALURU','svc-bengaluru','Bengaluru','KA');
update public.cities set status='CONFIGURING'
where id in (
 'e6000000-0000-4000-8000-000000000001',
 'e6000000-0000-4000-8000-000000000002'
);
update public.cities set status='READY_FOR_VALIDATION'
where id in (
 'e6000000-0000-4000-8000-000000000001',
 'e6000000-0000-4000-8000-000000000002'
);
update public.cities set status='ACTIVE'
where id in (
 'e6000000-0000-4000-8000-000000000001',
 'e6000000-0000-4000-8000-000000000002'
);

update public.city_configurations
set default_delivery_radius_meters=5000,
    maximum_delivery_radius_meters=10000,
    base_delivery_fee_paise=3000,
    per_km_delivery_fee_paise=500,
    local_delivery_enabled=true,
    postal_delivery_enabled=true
where city_id in (
 'e6000000-0000-4000-8000-000000000001',
 'e6000000-0000-4000-8000-000000000002'
);
select is(
  (select version::integer from public.city_configurations
   where city_id='e6000000-0000-4000-8000-000000000001'),
  2,
  'city configuration updates increment version'
);

insert into public.service_zones(
  id,city_id,code,slug,name,boundary,center_point,
  default_delivery_radius_meters
) values
('e6100000-0000-4000-8000-000000000001',
 'e6000000-0000-4000-8000-000000000001',
 'SVC_TIR_ZONE','svc-tir-zone','Tirupati Zone',
 extensions.st_multi(extensions.st_geomfromtext(
  'POLYGON((79.35 13.55,79.50 13.55,79.50 13.70,79.35 13.70,79.35 13.55))',
  4326)),
 'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,6000),
('e6100000-0000-4000-8000-000000000002',
 'e6000000-0000-4000-8000-000000000002',
 'SVC_BLR_ZONE','svc-blr-zone','Bengaluru Zone',
 extensions.st_multi(extensions.st_geomfromtext(
  'POLYGON((77.55 12.90,77.75 12.90,77.75 13.05,77.55 13.05,77.55 12.90))',
  4326)),
 'SRID=4326;POINT(77.6408 12.9784)'::extensions.geography,7000);
update public.service_zones set status='CONFIGURING'
where id in (
 'e6100000-0000-4000-8000-000000000001',
 'e6100000-0000-4000-8000-000000000002'
);
update public.service_zones set status='READY_FOR_VALIDATION'
where id in (
 'e6100000-0000-4000-8000-000000000001',
 'e6100000-0000-4000-8000-000000000002'
);
update public.service_zones set status='ACTIVE'
where id in (
 'e6100000-0000-4000-8000-000000000001',
 'e6100000-0000-4000-8000-000000000002'
);
insert into public.service_zone_pincodes(
 city_id,service_zone_id,pincode,priority,is_primary,is_active
) values
('e6000000-0000-4000-8000-000000000001',
 'e6100000-0000-4000-8000-000000000001','517501',10,true,true),
('e6000000-0000-4000-8000-000000000002',
 'e6100000-0000-4000-8000-000000000002','560038',10,true,true);

insert into public.shops(
 id,merchant_id,address_id,shop_code,name,slug,phone_number,location,
 verification_status,operational_status,accepts_online_orders
) values (
 'e3000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000001',
 'e2000000-0000-4000-8000-000000000001',
 'SVC-SHOP','Service Shop','service-shop','9100000201',
 'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
 'VERIFIED','OPEN',true
);
insert into public.products(
 id,shop_id,category_id,name,slug,moderation_status,is_active
) values (
 'e4000000-0000-4000-8000-000000000001',
 'e3000000-0000-4000-8000-000000000001',
 '30000000-0000-0000-0000-000000000001',
 'Service Kurta','service-kurta','APPROVED',true
);
insert into public.product_variants(
 id,product_id,shop_id,sku,colour_name,size_label,
 mrp_paise,selling_price_paise,is_active
) values (
 'e5000000-0000-4000-8000-000000000001',
 'e4000000-0000-4000-8000-000000000001',
 'e3000000-0000-4000-8000-000000000001',
 'SVC-KURTA-M','Blue','M',210000,190000,true
);

insert into public.merchant_branches(
 id,shop_id,merchant_id,city_id,primary_service_zone_id,branch_code,
 name,branch_type,address_id,return_address_id,pincode,location,
 local_delivery_enabled,postal_delivery_enabled,all_india_postal_enabled,
 accepts_walk_in,postal_dispatch_sla_hours
) values
('e3100000-0000-4000-8000-000000000001',
 'e3000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000001',
 'e6000000-0000-4000-8000-000000000001',
 'e6100000-0000-4000-8000-000000000001',
 'SVC-TIR-NEAR','Tirupati Near','PHYSICAL_STORE',
 'e2000000-0000-4000-8000-000000000001',
 'e2000000-0000-4000-8000-000000000001','517501',
 'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
 true,false,false,true,48),
('e3100000-0000-4000-8000-000000000002',
 'e3000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000001',
 'e6000000-0000-4000-8000-000000000001',
 'e6100000-0000-4000-8000-000000000001',
 'SVC-TIR-FAR','Tirupati Far','PHYSICAL_STORE',
 'e2000000-0000-4000-8000-000000000001',
 'e2000000-0000-4000-8000-000000000001','517501',
 'SRID=4326;POINT(79.4500 13.6500)'::extensions.geography,
 true,false,false,true,48),
('e3100000-0000-4000-8000-000000000003',
 'e3000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000001',
 'e6000000-0000-4000-8000-000000000002',
 'e6100000-0000-4000-8000-000000000002',
 'SVC-BLR-POSTAL','Bengaluru Postal','CLOUD_SHOP',
 'e2000000-0000-4000-8000-000000000002',
 'e2000000-0000-4000-8000-000000000002','560038',
 'SRID=4326;POINT(77.6408 12.9784)'::extensions.geography,
 false,true,false,true,24);

insert into public.branch_service_zones(
 branch_id,city_id,service_zone_id,is_primary,is_active
) values
('e3100000-0000-4000-8000-000000000001',
 'e6000000-0000-4000-8000-000000000001',
 'e6100000-0000-4000-8000-000000000001',true,true),
('e3100000-0000-4000-8000-000000000002',
 'e6000000-0000-4000-8000-000000000001',
 'e6100000-0000-4000-8000-000000000001',true,true);
insert into public.branch_postal_serviceability(
 branch_id,pincode,is_active
) values (
 'e3100000-0000-4000-8000-000000000003','517501',true
);

update public.merchant_branches
set verification_status='VERIFIED',
    geography_status='VERIFIED',
    status='VERIFICATION_PENDING'
where id in (
 'e3100000-0000-4000-8000-000000000001',
 'e3100000-0000-4000-8000-000000000002',
 'e3100000-0000-4000-8000-000000000003'
);
update public.merchant_branches set status='APPROVED'
where id in (
 'e3100000-0000-4000-8000-000000000001',
 'e3100000-0000-4000-8000-000000000002',
 'e3100000-0000-4000-8000-000000000003'
);
update public.merchant_branches set status='ACTIVE'
where id in (
 'e3100000-0000-4000-8000-000000000001',
 'e3100000-0000-4000-8000-000000000002',
 'e3100000-0000-4000-8000-000000000003'
);

select private.apply_branch_inventory_delta(
 'e3100000-0000-4000-8000-000000000001',
 'e5000000-0000-4000-8000-000000000001',
 6,0,0,1,'STOCK_RECEIVED','SYSTEM',
 'SERVICEABILITY_TEST',null,'near fixture',null
);
select private.apply_branch_inventory_delta(
 'e3100000-0000-4000-8000-000000000002',
 'e5000000-0000-4000-8000-000000000001',
 20,0,0,0,'STOCK_RECEIVED','SYSTEM',
 'SERVICEABILITY_TEST',null,'far fixture',null
);
select private.apply_branch_inventory_delta(
 'e3100000-0000-4000-8000-000000000003',
 'e5000000-0000-4000-8000-000000000001',
 40,0,0,0,'STOCK_RECEIVED','SYSTEM',
 'SERVICEABILITY_TEST',null,'postal fixture',null
);

create temporary table svc_results(
 label text primary key,
 payload jsonb not null
);

insert into svc_results values (
 'area',
 public.resolve_customer_service_area(13.6288,79.4192,'517501')
);
select is(
 (select payload->>'cityId' from svc_results where label='area'),
 'e6000000-0000-4000-8000-000000000001',
 'Tirupati address resolves to Tirupati'
);
select is(
 public.resolve_customer_service_area(13.8000,79.4192,'517501')
   ->>'reasonCode',
 'LOCATION_OUTSIDE_ZONE',
 'coordinates outside geofence fail closed'
);
select is(
 public.resolve_customer_service_area(13.6288,79.4192,'517599')
   ->>'reasonCode',
 'PINCODE_NOT_SUPPORTED',
 'unsupported pincode is rejected'
);

insert into svc_results values (
 'local',
 public.get_variant_serviceability_quote(
  'e5000000-0000-4000-8000-000000000001',
  1,13.6288,79.4192,'517501'
 )
);
select is(
 (select payload->>'fulfilmentMode' from svc_results where label='local'),
 'LOCAL_DELIVERY',
 'local delivery is preferred'
);
select is(
 (select payload->>'branchId' from svc_results where label='local'),
 'e3100000-0000-4000-8000-000000000001',
 'nearest eligible branch is selected deterministically'
);
select is(
 (select (payload->>'availableQuantity')::integer
  from svc_results where label='local'),
 5,
 'safety stock is excluded'
);
select is(
 (select (payload->>'deliveryFeePaise')::bigint
  from svc_results where label='local'),
 3000::bigint,
 'delivery fee is calculated server-side'
);
select is(
 (select (payload->>'codEligible')::boolean
  from svc_results where label='local'),
 true,
 'COD eligibility uses the city limit'
);
select is(
 (select count(*)::integer
  from public.branch_inventory_reservations
  where variant_id='e5000000-0000-4000-8000-000000000001'),
 0,
 'catalogue quote does not reserve inventory'
);
select is(
 public.revalidate_serviceability_quote(
  (select (payload->>'quoteId')::uuid
   from svc_results where label='local'),
  'e5000000-0000-4000-8000-000000000001',1
 )->>'valid',
 'true',
 'unchanged quote revalidates'
);

select private.apply_branch_inventory_delta(
 'e3100000-0000-4000-8000-000000000001',
 'e5000000-0000-4000-8000-000000000001',
 1,0,0,0,'STOCK_RECEIVED','SYSTEM',
 'SERVICEABILITY_TEST',null,'version change',null
);
select is(
 public.revalidate_serviceability_quote(
  (select (payload->>'quoteId')::uuid
   from svc_results where label='local'),
  'e5000000-0000-4000-8000-000000000001',1
 )->>'reasonCode',
 'BRANCH_INVENTORY_CHANGED',
 'inventory version changes invalidate quotes'
);

update public.merchant_branches set status='PAUSED'
where id in (
 'e3100000-0000-4000-8000-000000000001',
 'e3100000-0000-4000-8000-000000000002'
);
insert into svc_results values (
 'postal',
 public.get_variant_serviceability_quote(
  'e5000000-0000-4000-8000-000000000001',
  1,13.6288,79.4192,'517501'
 )
);
select is(
 (select payload->>'fulfilmentMode' from svc_results where label='postal'),
 'POSTAL_DELIVERY',
 'postal fallback is returned when local branches are paused'
);
select is(
 (select payload->>'paymentMode' from svc_results where label='postal'),
 'PREPAID_ONLY',
 'postal fallback is prepaid only'
);
select is(
 public.get_variant_serviceability_quote(
  'e5000000-0000-4000-8000-000000000001',
  1,13.6288,79.4192,'517502'
 )->>'reasonCode',
 'PINCODE_NOT_SUPPORTED',
 'restricted postal coverage rejects other pincodes'
);
update public.merchant_branches set all_india_postal_enabled=true
where id='e3100000-0000-4000-8000-000000000003';
select is(
 public.get_variant_serviceability_quote(
  'e5000000-0000-4000-8000-000000000001',
  1,13.6288,79.4192,'517502'
 )->>'fulfilmentMode',
 'POSTAL_DELIVERY',
 'all-India postal coverage provides fallback'
);

select throws_ok(
 $$select public.get_variant_serviceability_quote(
   'e5000000-0000-4000-8000-000000000001',
   0,13.6288,79.4192,'517501'
 )$$,
 '22023',
 'INVALID_SERVICEABILITY_QUOTE_INPUT',
 'invalid quantity is rejected'
);

select * from finish();
rollback;
