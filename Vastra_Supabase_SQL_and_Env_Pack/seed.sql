-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


-- Seed roles, permissions, root categories and initial settings.

insert into public.roles(code,name,description,is_system_role) values ('SUPER_ADMIN','Super Admin','Super Admin role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('CITY_OPERATIONS','City Operations','City Operations role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('ORDER_OPERATIONS','Order Operations','Order Operations role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('MERCHANT_SUPPORT','Merchant Support','Merchant Support role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('MERCHANT_ONBOARDING','Merchant Onboarding','Merchant Onboarding role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('CATALOGUE_MODERATOR','Catalogue Moderator','Catalogue Moderator role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('DELIVERY_OPERATIONS','Delivery Operations','Delivery Operations role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('CUSTOMER_SUPPORT','Customer Support','Customer Support role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('FINANCE','Finance','Finance role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('MARKETING','Marketing','Marketing role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('FRAUD_RISK','Fraud & Risk','Fraud & Risk role',true) on conflict (code) do nothing;
insert into public.roles(code,name,description,is_system_role) values ('ANALYTICS_VIEWER','Analytics Viewer','Analytics Viewer role',true) on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('platform.read','Platform','platform.read','Read operational data') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('platform.write','Platform','platform.write','Perform allowed administrative changes') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('merchant.kyc.review','Merchant','merchant.kyc.review','Review merchant KYC') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('merchant.approve','Merchant','merchant.approve','Approve merchant') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('order.reassign_captain','Orders','order.reassign_captain','Reassign captain') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('refund.create','Finance','refund.create','Create refund') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('refund.approve_large','Finance','refund.approve_large','Approve large refund') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('settlement.adjust','Finance','settlement.adjust','Adjust settlement') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('campaign.publish','Marketing','campaign.publish','Publish campaign') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('account.suspend','Risk','account.suspend','Suspend account') on conflict (code) do nothing;
insert into public.permissions(code,module,name,description) values ('audit.view','Governance','audit.view','View audit logs') on conflict (code) do nothing;
insert into public.role_permissions(role_id, permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='SUPER_ADMIN' on conflict do nothing;
insert into public.role_permissions(role_id, permission_id) select r.id,p.id from public.roles r join public.permissions p on p.code='platform.read' where r.code='ANALYTICS_VIEWER' on conflict do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Clothing','clothing',1,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Footwear','footwear',2,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Accessories','accessories',3,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Men','men',4,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Women','women',5,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Kids','kids',6,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Belts','belts',7,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Watches','watches',8,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Bags','bags',9,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Jewellery','jewellery',10,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Pocket Squares','pocket-squares',11,true) on conflict (slug) do nothing;
insert into public.categories(name,slug,display_order,is_active) values ('Handkerchiefs','handkerchiefs',12,true) on conflict (slug) do nothing;
insert into public.system_settings(setting_key,setting_value,value_type,scope_type,scope_id,updated_by) select 'merchant_order_response_seconds','120'::jsonb,'NUMBER','GLOBAL',null,id from public.profiles where account_type='ADMIN' order by created_at limit 1 on conflict do nothing;
