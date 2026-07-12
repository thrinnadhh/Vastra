-- Vastra production query indexes.
--
-- Unique constraints already create their own indexes. These indexes cover
-- ownership, status feeds, time-ordered histories, dispatch, and outbox work.

create index if not exists profiles_account_type_status_idx
on public.profiles (account_type, status);

create index if not exists user_devices_user_active_idx
on public.user_devices (user_id, revoked_at);

create index if not exists addresses_user_default_idx
on public.addresses (user_id, is_default);

create index if not exists shops_merchant_idx
on public.shops (merchant_id);

create index if not exists shops_public_status_idx
on public.shops (
  verification_status,
  operational_status,
  deleted_at
);

create index if not exists shops_location_gist_idx
on public.shops
using gist (location);

create index if not exists shop_hours_shop_idx
on public.shop_hours (shop_id);

create index if not exists shop_documents_shop_idx
on public.shop_documents (shop_id, verification_status);

create index if not exists shop_bank_accounts_shop_idx
on public.shop_bank_accounts (shop_id, is_primary);

create index if not exists categories_parent_display_idx
on public.categories (parent_id, display_order);

create index if not exists products_shop_active_idx
on public.products (
  shop_id,
  is_active,
  moderation_status,
  deleted_at
);

create index if not exists products_category_active_idx
on public.products (
  category_id,
  is_active,
  moderation_status
);

create index if not exists products_search_vector_gin_idx
on public.products
using gin (search_vector);

create index if not exists product_variants_product_active_idx
on public.product_variants (product_id, is_active);

create index if not exists product_variants_shop_active_idx
on public.product_variants (shop_id, is_active);

create index if not exists product_images_product_order_idx
on public.product_images (
  product_id,
  display_order,
  created_at
);

create index if not exists product_images_variant_idx
on public.product_images (variant_id)
where variant_id is not null;

create index if not exists variant_barcodes_variant_idx
on public.variant_barcodes (variant_id);

create index if not exists inventory_balances_variant_idx
on public.inventory_balances (variant_id);

create index if not exists inventory_movements_shop_created_idx
on public.inventory_movements (
  shop_id,
  created_at desc
);

create index if not exists inventory_movements_variant_created_idx
on public.inventory_movements (
  variant_id,
  created_at desc
);

create index if not exists inventory_reservations_expiry_idx
on public.inventory_reservations (
  status,
  expires_at
);

create index if not exists carts_customer_status_idx
on public.carts (customer_id, status, updated_at desc);

create index if not exists cart_items_cart_idx
on public.cart_items (cart_id, added_at);

create index if not exists orders_customer_created_idx
on public.orders (customer_id, created_at desc);

create index if not exists orders_shop_status_created_idx
on public.orders (
  shop_id,
  status,
  created_at desc
);

create index if not exists orders_status_updated_idx
on public.orders (status, updated_at);

create index if not exists order_items_order_idx
on public.order_items (order_id);

create index if not exists order_status_history_order_created_idx
on public.order_status_history (
  order_id,
  created_at,
  id
);

create index if not exists merchant_order_alerts_shop_status_idx
on public.merchant_order_alerts (
  shop_id,
  alert_status,
  expires_at
);

create index if not exists merchant_order_issues_order_status_idx
on public.merchant_order_issues (
  order_id,
  resolution_status,
  created_at desc
);

create index if not exists order_item_verifications_item_idx
on public.order_item_verifications (
  order_item_id,
  verified_at desc
);

create index if not exists delivery_tasks_order_idx
on public.delivery_tasks (order_id)
where order_id is not null;

create index if not exists delivery_tasks_captain_status_idx
on public.delivery_tasks (
  assigned_captain_id,
  status,
  updated_at desc
);

create index if not exists delivery_tasks_status_scheduled_idx
on public.delivery_tasks (
  status,
  scheduled_at,
  created_at
);

create index if not exists delivery_assignments_task_status_idx
on public.delivery_assignments (
  delivery_task_id,
  assignment_status,
  offered_at desc
);

create index if not exists delivery_assignments_captain_status_idx
on public.delivery_assignments (
  captain_id,
  assignment_status,
  offered_at desc
);

create index if not exists captain_current_locations_location_gist_idx
on public.captain_current_locations
using gist (location);

create index if not exists captain_location_history_task_recorded_idx
on public.captain_location_history (
  delivery_task_id,
  recorded_at desc
);

create index if not exists captain_location_history_captain_recorded_idx
on public.captain_location_history (
  captain_id,
  recorded_at desc
);

create index if not exists delivery_events_task_created_idx
on public.delivery_events (
  delivery_task_id,
  created_at,
  id
);

create index if not exists cod_collections_captain_status_idx
on public.cod_collections (
  captain_id,
  status,
  created_at desc
);

create index if not exists payments_order_status_idx
on public.payments (
  order_id,
  status,
  created_at desc
);

create index if not exists payment_events_payment_received_idx
on public.payment_events (
  payment_id,
  received_at desc
);

create index if not exists payment_events_processing_idx
on public.payment_events (
  processing_status,
  received_at
);

create index if not exists return_requests_customer_created_idx
on public.return_requests (
  customer_id,
  created_at desc
);

create index if not exists return_requests_shop_status_idx
on public.return_requests (
  shop_id,
  status,
  created_at desc
);

create index if not exists return_items_request_idx
on public.return_items (return_request_id);

create index if not exists return_evidence_request_created_idx
on public.return_evidence (
  return_request_id,
  created_at
);

create index if not exists return_status_history_request_created_idx
on public.return_status_history (
  return_request_id,
  created_at,
  id
);

create index if not exists refunds_order_status_idx
on public.refunds (
  order_id,
  status,
  created_at desc
);

create index if not exists merchant_settlements_shop_status_idx
on public.merchant_settlements (
  shop_id,
  status,
  period_end desc
);

create index if not exists merchant_settlement_items_settlement_idx
on public.merchant_settlement_items (
  settlement_id,
  created_at
);

create index if not exists captain_earnings_captain_status_idx
on public.captain_earnings (
  captain_id,
  status,
  created_at desc
);

create index if not exists captain_payouts_captain_status_idx
on public.captain_payouts (
  captain_id,
  status,
  period_end desc
);

create index if not exists captain_payout_items_payout_idx
on public.captain_payout_items (
  payout_id,
  created_at
);

create index if not exists notifications_user_unread_idx
on public.notifications (
  user_id,
  created_at desc
)
where read_at is null;

create index if not exists notification_deliveries_notification_status_idx
on public.notification_deliveries (
  notification_id,
  status,
  created_at
);

create index if not exists support_tickets_requester_status_idx
on public.support_tickets (
  raised_by_user_id,
  status,
  updated_at desc
);

create index if not exists support_tickets_assignee_status_idx
on public.support_tickets (
  assigned_to,
  status,
  updated_at desc
)
where assigned_to is not null;

create index if not exists support_messages_ticket_created_idx
on public.support_messages (
  ticket_id,
  created_at,
  id
);

create index if not exists approval_requests_status_created_idx
on public.approval_requests (
  status,
  created_at
);

create index if not exists audit_logs_entity_created_idx
on public.audit_logs (
  entity_type,
  entity_id,
  created_at desc
);

create index if not exists audit_logs_actor_created_idx
on public.audit_logs (
  actor_user_id,
  created_at desc
);

create index if not exists outbox_events_aggregate_idx
on public.outbox_events (
  aggregate_type,
  aggregate_id,
  occurred_at
);

create index if not exists outbox_events_worker_idx
on public.outbox_events (
  status,
  available_at,
  attempt_count
)
where status in ('PENDING', 'FAILED');

create index if not exists system_settings_scope_lookup_idx
on public.system_settings (
  scope_type,
  scope_id,
  setting_key
);
