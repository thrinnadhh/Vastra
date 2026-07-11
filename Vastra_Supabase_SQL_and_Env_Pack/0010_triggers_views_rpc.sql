-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


drop trigger if exists set_profiles_updated_at on public."profiles";
create trigger set_profiles_updated_at before update on public."profiles" for each row execute procedure private.set_updated_at();

drop trigger if exists set_user_devices_updated_at on public."user_devices";
create trigger set_user_devices_updated_at before update on public."user_devices" for each row execute procedure private.set_updated_at();

drop trigger if exists set_addresses_updated_at on public."addresses";
create trigger set_addresses_updated_at before update on public."addresses" for each row execute procedure private.set_updated_at();

drop trigger if exists set_customer_profiles_updated_at on public."customer_profiles";
create trigger set_customer_profiles_updated_at before update on public."customer_profiles" for each row execute procedure private.set_updated_at();

drop trigger if exists set_customer_preferences_updated_at on public."customer_preferences";
create trigger set_customer_preferences_updated_at before update on public."customer_preferences" for each row execute procedure private.set_updated_at();

drop trigger if exists set_merchant_profiles_updated_at on public."merchant_profiles";
create trigger set_merchant_profiles_updated_at before update on public."merchant_profiles" for each row execute procedure private.set_updated_at();

drop trigger if exists set_captain_profiles_updated_at on public."captain_profiles";
create trigger set_captain_profiles_updated_at before update on public."captain_profiles" for each row execute procedure private.set_updated_at();

drop trigger if exists set_admin_profiles_updated_at on public."admin_profiles";
create trigger set_admin_profiles_updated_at before update on public."admin_profiles" for each row execute procedure private.set_updated_at();

drop trigger if exists set_shops_updated_at on public."shops";
create trigger set_shops_updated_at before update on public."shops" for each row execute procedure private.set_updated_at();

drop trigger if exists set_shop_hours_updated_at on public."shop_hours";
create trigger set_shop_hours_updated_at before update on public."shop_hours" for each row execute procedure private.set_updated_at();

drop trigger if exists set_shop_bank_accounts_updated_at on public."shop_bank_accounts";
create trigger set_shop_bank_accounts_updated_at before update on public."shop_bank_accounts" for each row execute procedure private.set_updated_at();

drop trigger if exists set_categories_updated_at on public."categories";
create trigger set_categories_updated_at before update on public."categories" for each row execute procedure private.set_updated_at();

drop trigger if exists set_products_updated_at on public."products";
create trigger set_products_updated_at before update on public."products" for each row execute procedure private.set_updated_at();

drop trigger if exists set_product_variants_updated_at on public."product_variants";
create trigger set_product_variants_updated_at before update on public."product_variants" for each row execute procedure private.set_updated_at();

drop trigger if exists set_inventory_balances_updated_at on public."inventory_balances";
create trigger set_inventory_balances_updated_at before update on public."inventory_balances" for each row execute procedure private.set_updated_at();

drop trigger if exists set_shop_collections_updated_at on public."shop_collections";
create trigger set_shop_collections_updated_at before update on public."shop_collections" for each row execute procedure private.set_updated_at();

drop trigger if exists set_offers_updated_at on public."offers";
create trigger set_offers_updated_at before update on public."offers" for each row execute procedure private.set_updated_at();

drop trigger if exists set_carts_updated_at on public."carts";
create trigger set_carts_updated_at before update on public."carts" for each row execute procedure private.set_updated_at();

drop trigger if exists set_cart_items_updated_at on public."cart_items";
create trigger set_cart_items_updated_at before update on public."cart_items" for each row execute procedure private.set_updated_at();

drop trigger if exists set_orders_updated_at on public."orders";
create trigger set_orders_updated_at before update on public."orders" for each row execute procedure private.set_updated_at();

drop trigger if exists set_payments_updated_at on public."payments";
create trigger set_payments_updated_at before update on public."payments" for each row execute procedure private.set_updated_at();

drop trigger if exists set_return_requests_updated_at on public."return_requests";
create trigger set_return_requests_updated_at before update on public."return_requests" for each row execute procedure private.set_updated_at();

drop trigger if exists set_refunds_updated_at on public."refunds";
create trigger set_refunds_updated_at before update on public."refunds" for each row execute procedure private.set_updated_at();

drop trigger if exists set_merchant_settlements_updated_at on public."merchant_settlements";
create trigger set_merchant_settlements_updated_at before update on public."merchant_settlements" for each row execute procedure private.set_updated_at();

drop trigger if exists set_delivery_tasks_updated_at on public."delivery_tasks";
create trigger set_delivery_tasks_updated_at before update on public."delivery_tasks" for each row execute procedure private.set_updated_at();

drop trigger if exists set_captain_current_locations_updated_at on public."captain_current_locations";
create trigger set_captain_current_locations_updated_at before update on public."captain_current_locations" for each row execute procedure private.set_updated_at();

drop trigger if exists set_captain_payouts_updated_at on public."captain_payouts";
create trigger set_captain_payouts_updated_at before update on public."captain_payouts" for each row execute procedure private.set_updated_at();

drop trigger if exists set_style_groups_updated_at on public."style_groups";
create trigger set_style_groups_updated_at before update on public."style_groups" for each row execute procedure private.set_updated_at();

drop trigger if exists set_style_group_member_preferences_updated_at on public."style_group_member_preferences";
create trigger set_style_group_member_preferences_updated_at before update on public."style_group_member_preferences" for each row execute procedure private.set_updated_at();

drop trigger if exists set_style_themes_updated_at on public."style_themes";
create trigger set_style_themes_updated_at before update on public."style_themes" for each row execute procedure private.set_updated_at();

drop trigger if exists set_style_moodboards_updated_at on public."style_moodboards";
create trigger set_style_moodboards_updated_at before update on public."style_moodboards" for each row execute procedure private.set_updated_at();

drop trigger if exists set_notification_preferences_updated_at on public."notification_preferences";
create trigger set_notification_preferences_updated_at before update on public."notification_preferences" for each row execute procedure private.set_updated_at();

drop trigger if exists set_reviews_updated_at on public."reviews";
create trigger set_reviews_updated_at before update on public."reviews" for each row execute procedure private.set_updated_at();

drop trigger if exists set_product_embeddings_updated_at on public."product_embeddings";
create trigger set_product_embeddings_updated_at before update on public."product_embeddings" for each row execute procedure private.set_updated_at();

drop trigger if exists set_customer_embeddings_updated_at on public."customer_embeddings";
create trigger set_customer_embeddings_updated_at before update on public."customer_embeddings" for each row execute procedure private.set_updated_at();

drop trigger if exists set_size_charts_updated_at on public."size_charts";
create trigger set_size_charts_updated_at before update on public."size_charts" for each row execute procedure private.set_updated_at();

drop trigger if exists set_customer_body_profiles_updated_at on public."customer_body_profiles";
create trigger set_customer_body_profiles_updated_at before update on public."customer_body_profiles" for each row execute procedure private.set_updated_at();

drop trigger if exists set_support_tickets_updated_at on public."support_tickets";
create trigger set_support_tickets_updated_at before update on public."support_tickets" for each row execute procedure private.set_updated_at();

drop trigger if exists set_campaigns_updated_at on public."campaigns";
create trigger set_campaigns_updated_at before update on public."campaigns" for each row execute procedure private.set_updated_at();

drop trigger if exists set_merchant_leads_updated_at on public."merchant_leads";
create trigger set_merchant_leads_updated_at before update on public."merchant_leads" for each row execute procedure private.set_updated_at();

drop trigger if exists set_field_visits_updated_at on public."field_visits";
create trigger set_field_visits_updated_at before update on public."field_visits" for each row execute procedure private.set_updated_at();

drop trigger if exists set_system_settings_updated_at on public."system_settings";
create trigger set_system_settings_updated_at before update on public."system_settings" for each row execute procedure private.set_updated_at();

drop trigger if exists set_service_zones_updated_at on public."service_zones";
create trigger set_service_zones_updated_at before update on public."service_zones" for each row execute procedure private.set_updated_at();


-- Safe computed inventory availability.
create or replace view public.inventory_availability
with (security_invoker = true)
as
select
  ib.id,
  ib.shop_id,
  ib.variant_id,
  ib.stock_on_hand,
  ib.reserved_quantity,
  ib.damaged_quantity,
  greatest(ib.stock_on_hand - ib.reserved_quantity - ib.damaged_quantity, 0) as available_quantity,
  ib.reorder_level,
  ib.version,
  ib.updated_at
from public.inventory_balances ib;

-- Catalogue search vector. This can support MVP search before moving to Typesense/OpenSearch.
create or replace function private.products_search_vector()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.brand,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.description,'')), 'C');
  return new;
end;
$$;

drop trigger if exists products_search_vector_trigger on public.products;
create trigger products_search_vector_trigger
before insert or update of name, brand, description on public.products
for each row execute procedure private.products_search_vector();

-- RLS helper: merchant owns a shop.
create or replace function private.owns_shop(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shops s
    where s.id = p_shop_id
      and s.merchant_id = (select auth.uid())
      and s.deleted_at is null
  );
$$;
revoke all on function private.owns_shop(uuid) from public;
grant execute on function private.owns_shop(uuid) to authenticated;

-- RLS helper: user has an active permission through any active role.
create or replace function private.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = (select auth.uid())
      and ur.revoked_at is null
      and p.code = p_permission
  );
$$;
revoke all on function private.has_permission(text) from public;
grant execute on function private.has_permission(text) to authenticated;

-- RLS helper: current user is a member or creator of a Group Style group.
create or replace function private.is_style_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.style_groups g
    where g.id = p_group_id and g.creator_customer_id = (select auth.uid())
  ) or exists (
    select 1 from public.style_group_members m
    where m.group_id = p_group_id
      and m.customer_id = (select auth.uid())
      and m.status = 'JOINED'
  );
$$;
revoke all on function private.is_style_group_member(uuid) from public;
grant execute on function private.is_style_group_member(uuid) to authenticated;

-- Strict inventory adjustment primitive. Call only from trusted backend/Edge Function.
create or replace function private.apply_inventory_delta(
  p_shop_id uuid,
  p_variant_id uuid,
  p_stock_delta integer,
  p_reserved_delta integer,
  p_damaged_delta integer,
  p_movement_type text,
  p_source_method text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null,
  p_actor uuid default null
)
returns public.inventory_balances
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row public.inventory_balances;
  after_row public.inventory_balances;
begin
  select * into before_row
  from public.inventory_balances
  where shop_id = p_shop_id and variant_id = p_variant_id
  for update;

  if not found then
    insert into public.inventory_balances(shop_id, variant_id)
    values (p_shop_id, p_variant_id)
    returning * into before_row;
  end if;

  update public.inventory_balances
  set stock_on_hand = stock_on_hand + p_stock_delta,
      reserved_quantity = reserved_quantity + p_reserved_delta,
      damaged_quantity = damaged_quantity + p_damaged_delta,
      version = version + 1
  where id = before_row.id
  returning * into after_row;

  if after_row.stock_on_hand < 0
     or after_row.reserved_quantity < 0
     or after_row.damaged_quantity < 0
     or after_row.stock_on_hand < after_row.reserved_quantity + after_row.damaged_quantity then
    raise exception 'Invalid inventory delta for variant %', p_variant_id;
  end if;

  insert into public.inventory_movements(
    shop_id, variant_id, movement_type,
    quantity_change, reserved_change, damaged_change,
    stock_before, stock_after, reserved_before, reserved_after,
    damaged_before, damaged_after, reference_type, reference_id,
    reason, performed_by, source_method
  ) values (
    p_shop_id, p_variant_id, p_movement_type,
    p_stock_delta, p_reserved_delta, p_damaged_delta,
    before_row.stock_on_hand, after_row.stock_on_hand,
    before_row.reserved_quantity, after_row.reserved_quantity,
    before_row.damaged_quantity, after_row.damaged_quantity,
    p_reference_type, p_reference_id, p_reason, p_actor, p_source_method
  );
  return after_row;
end;
$$;
revoke all on function private.apply_inventory_delta(uuid,uuid,integer,integer,integer,text,text,text,uuid,text,uuid) from public, anon, authenticated;
