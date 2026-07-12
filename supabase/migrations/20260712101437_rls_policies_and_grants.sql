-- Vastra final client grants and row-level security policies.
--
-- Backend/service-role workflows retain responsibility for privileged writes.
-- Direct authenticated writes are restricted to user-owned low-risk records.

revoke all privileges
on all tables in schema public
from anon, authenticated;

revoke all privileges
on all sequences in schema public
from anon, authenticated;

grant select
on all tables in schema public
to authenticated;

grant select
on table
  public.shops,
  public.shop_hours,
  public.categories,
  public.products,
  public.product_variants,
  public.product_images
to anon;

grant insert, update, delete
on table
  public.user_devices,
  public.addresses,
  public.carts,
  public.cart_items,
  public.notification_preferences
to authenticated;

grant insert
on table
  public.support_tickets,
  public.support_messages
to authenticated;

grant update (read_at)
on public.notifications
to authenticated;

grant usage, select
on sequence public.support_messages_id_seq
to authenticated;

-- Every current public table receives an administrator read policy.
-- This also guarantees that no public table is accidentally policy-less.

do $$
declare
  table_record record;
begin
  for table_record in
    select pt.tablename
    from pg_tables pt
    where pt.schemaname = 'public'
    order by pt.tablename
  loop
    execute format(
      'create policy %I on public.%I
       for select to authenticated
       using (authz.is_admin())',
      left(
        'admin_read_' || table_record.tablename,
        63
      ),
      table_record.tablename
    );
  end loop;
end;
$$;

-- Public marketplace reads.

create policy categories_public_read
on public.categories
for select
to anon, authenticated
using (is_active);

create policy shops_public_read
on public.shops
for select
to anon, authenticated
using (authz.is_public_shop(id));

create policy shop_hours_public_read
on public.shop_hours
for select
to anon, authenticated
using (authz.is_public_shop(shop_id));

create policy products_public_read
on public.products
for select
to anon, authenticated
using (authz.is_public_product(id));

create policy product_variants_public_read
on public.product_variants
for select
to anon, authenticated
using (
  is_active
  and authz.is_public_product(product_id)
);

create policy product_images_public_read
on public.product_images
for select
to anon, authenticated
using (authz.is_public_product(product_id));

-- Identity ownership.

create policy profiles_self_read
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy user_devices_self_access
on public.user_devices
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy addresses_self_access
on public.addresses
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy customer_profiles_self_read
on public.customer_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy merchant_profiles_self_read
on public.merchant_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy captain_profiles_self_read
on public.captain_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy admin_profiles_self_read
on public.admin_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy user_roles_self_read
on public.user_roles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy roles_assigned_read
on public.roles
for select
to authenticated
using (authz.has_role(code));

create policy permissions_assigned_read
on public.permissions
for select
to authenticated
using (authz.has_permission(code));

-- Merchant-owned marketplace data.

create policy shops_merchant_read
on public.shops
for select
to authenticated
using (authz.owns_shop(id));

create policy shop_hours_merchant_read
on public.shop_hours
for select
to authenticated
using (authz.owns_shop(shop_id));

create policy shop_documents_merchant_read
on public.shop_documents
for select
to authenticated
using (authz.owns_shop(shop_id));

create policy shop_bank_accounts_merchant_read
on public.shop_bank_accounts
for select
to authenticated
using (authz.owns_shop(shop_id));

create policy products_merchant_read
on public.products
for select
to authenticated
using (authz.owns_shop(shop_id));

create policy product_variants_merchant_read
on public.product_variants
for select
to authenticated
using (authz.owns_shop(shop_id));

create policy product_images_merchant_read
on public.product_images
for select
to authenticated
using (authz.owns_product(product_id));

create policy variant_barcodes_merchant_read
on public.variant_barcodes
for select
to authenticated
using (authz.owns_variant(variant_id));

create policy inventory_balances_merchant_read
on public.inventory_balances
for select
to authenticated
using (authz.owns_shop(shop_id));

create policy inventory_movements_merchant_read
on public.inventory_movements
for select
to authenticated
using (authz.owns_shop(shop_id));

create policy inventory_reservations_authorized_read
on public.inventory_reservations
for select
to authenticated
using (
  authz.owns_shop(shop_id)
  or (
    cart_id is not null
    and exists (
      select 1
      from public.carts c
      where c.id = cart_id
        and c.customer_id = (select auth.uid())
    )
  )
  or (
    order_id is not null
    and authz.can_access_order(order_id)
  )
);

-- Customer carts.

create policy carts_customer_read
on public.carts
for select
to authenticated
using (customer_id = (select auth.uid()));

create policy carts_customer_insert
on public.carts
for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and status::text = 'ACTIVE'
);

create policy carts_customer_update
on public.carts
for update
to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

create policy carts_customer_delete
on public.carts
for delete
to authenticated
using (customer_id = (select auth.uid()));

create policy cart_items_customer_access
on public.cart_items
for all
to authenticated
using (
  exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and c.customer_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and c.customer_id = (select auth.uid())
  )
);

-- Orders and merchant fulfilment.

create policy orders_authorized_read
on public.orders
for select
to authenticated
using (authz.can_access_order(id));

create policy order_items_authorized_read
on public.order_items
for select
to authenticated
using (authz.can_access_order(order_id));

create policy order_status_history_authorized_read
on public.order_status_history
for select
to authenticated
using (authz.can_access_order(order_id));

create policy merchant_order_alerts_merchant_read
on public.merchant_order_alerts
for select
to authenticated
using (authz.owns_shop(shop_id));

create policy merchant_order_issues_authorized_read
on public.merchant_order_issues
for select
to authenticated
using (authz.can_access_order(order_id));

create policy order_item_verifications_authorized_read
on public.order_item_verifications
for select
to authenticated
using (
  exists (
    select 1
    from public.order_items oi
    where oi.id = order_item_id
      and authz.can_access_order(oi.order_id)
  )
);

-- Delivery.

create policy delivery_tasks_authorized_read
on public.delivery_tasks
for select
to authenticated
using (authz.can_access_delivery_task(id));

create policy delivery_assignments_authorized_read
on public.delivery_assignments
for select
to authenticated
using (
  captain_id = (select auth.uid())
  or authz.can_access_delivery_task(delivery_task_id)
);

create policy captain_current_locations_authorized_read
on public.captain_current_locations
for select
to authenticated
using (
  captain_id = (select auth.uid())
  or (
    active_delivery_task_id is not null
    and authz.can_access_delivery_task(
      active_delivery_task_id
    )
  )
);

create policy captain_location_history_self_read
on public.captain_location_history
for select
to authenticated
using (captain_id = (select auth.uid()));

create policy delivery_events_authorized_read
on public.delivery_events
for select
to authenticated
using (
  authz.can_access_delivery_task(delivery_task_id)
);

create policy cod_collections_authorized_read
on public.cod_collections
for select
to authenticated
using (
  captain_id = (select auth.uid())
  or authz.can_access_order(order_id)
);

-- Payments and returns.

create policy payments_customer_read
on public.payments
for select
to authenticated
using (customer_id = (select auth.uid()));

create policy return_requests_authorized_read
on public.return_requests
for select
to authenticated
using (
  customer_id = (select auth.uid())
  or authz.owns_shop(shop_id)
);

create policy return_items_authorized_read
on public.return_items
for select
to authenticated
using (
  authz.can_access_return(return_request_id)
);

create policy return_evidence_authorized_read
on public.return_evidence
for select
to authenticated
using (
  authz.can_access_return(return_request_id)
);

create policy return_status_history_authorized_read
on public.return_status_history
for select
to authenticated
using (
  authz.can_access_return(return_request_id)
);

create policy refunds_authorized_read
on public.refunds
for select
to authenticated
using (authz.can_access_order(order_id));

-- Merchant and captain finance.

create policy merchant_settlements_merchant_read
on public.merchant_settlements
for select
to authenticated
using (authz.owns_shop(shop_id));

create policy merchant_settlement_items_merchant_read
on public.merchant_settlement_items
for select
to authenticated
using (
  exists (
    select 1
    from public.merchant_settlements ms
    where ms.id = settlement_id
      and authz.owns_shop(ms.shop_id)
  )
);

create policy captain_earnings_self_read
on public.captain_earnings
for select
to authenticated
using (captain_id = (select auth.uid()));

create policy captain_payouts_self_read
on public.captain_payouts
for select
to authenticated
using (captain_id = (select auth.uid()));

create policy captain_payout_items_self_read
on public.captain_payout_items
for select
to authenticated
using (
  exists (
    select 1
    from public.captain_payouts cp
    where cp.id = payout_id
      and cp.captain_id = (select auth.uid())
  )
);

-- Notifications.

create policy notifications_self_read
on public.notifications
for select
to authenticated
using (user_id = (select auth.uid()));

create policy notifications_self_mark_read
on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy notification_deliveries_self_read
on public.notification_deliveries
for select
to authenticated
using (
  exists (
    select 1
    from public.notifications n
    where n.id = notification_id
      and n.user_id = (select auth.uid())
  )
);

create policy notification_preferences_self_access
on public.notification_preferences
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Support.

create policy support_tickets_authorized_read
on public.support_tickets
for select
to authenticated
using (authz.can_access_support_ticket(id));

create policy support_tickets_requester_insert
on public.support_tickets
for insert
to authenticated
with check (
  raised_by_user_id = (select auth.uid())
  and status::text = 'OPEN'
  and assigned_to is null
  and resolution_code is null
  and resolution_note is null
  and resolved_at is null
  and closed_at is null
);

create policy support_messages_authorized_read
on public.support_messages
for select
to authenticated
using (authz.can_access_support_ticket(ticket_id));

create policy support_messages_requester_insert
on public.support_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and not is_internal_note
  and authz.can_access_support_ticket(ticket_id)
);

-- Requests created by an authenticated administrator remain visible to them.

create policy approval_requests_requester_read
on public.approval_requests
for select
to authenticated
using (requested_by = (select auth.uid()));

-- Non-secret settings may be read by authenticated applications.

create policy system_settings_nonsecret_read
on public.system_settings
for select
to authenticated
using (not is_secret);
