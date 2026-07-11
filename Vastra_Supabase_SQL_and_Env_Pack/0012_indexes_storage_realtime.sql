-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


create index if not exists "profiles_id_idx" on public."profiles" ("id");
create index if not exists "profiles_status_idx" on public."profiles" ("status");
create index if not exists "profiles_created_at_idx" on public."profiles" ("created_at");
create index if not exists "profiles_updated_at_idx" on public."profiles" ("updated_at");
create index if not exists "user_devices_user_id_idx" on public."user_devices" ("user_id");
create index if not exists "user_devices_created_at_idx" on public."user_devices" ("created_at");
create index if not exists "user_devices_updated_at_idx" on public."user_devices" ("updated_at");
create index if not exists "addresses_user_id_idx" on public."addresses" ("user_id");
create index if not exists "addresses_city_idx" on public."addresses" ("city");
create index if not exists "addresses_created_at_idx" on public."addresses" ("created_at");
create index if not exists "addresses_updated_at_idx" on public."addresses" ("updated_at");
create index if not exists "customer_profiles_user_id_idx" on public."customer_profiles" ("user_id");
create index if not exists "customer_profiles_default_address_id_idx" on public."customer_profiles" ("default_address_id");
create index if not exists "customer_profiles_created_at_idx" on public."customer_profiles" ("created_at");
create index if not exists "customer_profiles_updated_at_idx" on public."customer_profiles" ("updated_at");
create index if not exists "customer_preferences_customer_id_idx" on public."customer_preferences" ("customer_id");
create index if not exists "customer_preferences_updated_at_idx" on public."customer_preferences" ("updated_at");
create index if not exists "merchant_profiles_user_id_idx" on public."merchant_profiles" ("user_id");
create index if not exists "merchant_profiles_approved_by_idx" on public."merchant_profiles" ("approved_by");
create index if not exists "merchant_profiles_created_at_idx" on public."merchant_profiles" ("created_at");
create index if not exists "merchant_profiles_updated_at_idx" on public."merchant_profiles" ("updated_at");
create index if not exists "captain_profiles_user_id_idx" on public."captain_profiles" ("user_id");
create index if not exists "captain_profiles_created_at_idx" on public."captain_profiles" ("created_at");
create index if not exists "captain_profiles_updated_at_idx" on public."captain_profiles" ("updated_at");
create index if not exists "admin_profiles_user_id_idx" on public."admin_profiles" ("user_id");
create index if not exists "admin_profiles_manager_id_idx" on public."admin_profiles" ("manager_id");
create index if not exists "admin_profiles_created_at_idx" on public."admin_profiles" ("created_at");
create index if not exists "admin_profiles_updated_at_idx" on public."admin_profiles" ("updated_at");
create index if not exists "roles_created_at_idx" on public."roles" ("created_at");
create index if not exists "permissions_created_at_idx" on public."permissions" ("created_at");
create index if not exists "user_roles_user_id_idx" on public."user_roles" ("user_id");
create index if not exists "user_roles_role_id_idx" on public."user_roles" ("role_id");
create index if not exists "user_roles_assigned_by_idx" on public."user_roles" ("assigned_by");
create index if not exists "role_permissions_role_id_idx" on public."role_permissions" ("role_id");
create index if not exists "role_permissions_permission_id_idx" on public."role_permissions" ("permission_id");
create index if not exists "role_permissions_created_at_idx" on public."role_permissions" ("created_at");
create index if not exists "shops_merchant_id_idx" on public."shops" ("merchant_id");
create index if not exists "shops_city_idx" on public."shops" ("city");
create index if not exists "shops_created_at_idx" on public."shops" ("created_at");
create index if not exists "shops_updated_at_idx" on public."shops" ("updated_at");
create index if not exists "shop_hours_shop_id_idx" on public."shop_hours" ("shop_id");
create index if not exists "shop_hours_created_at_idx" on public."shop_hours" ("created_at");
create index if not exists "shop_hours_updated_at_idx" on public."shop_hours" ("updated_at");
create index if not exists "shop_documents_shop_id_idx" on public."shop_documents" ("shop_id");
create index if not exists "shop_documents_uploaded_by_idx" on public."shop_documents" ("uploaded_by");
create index if not exists "shop_documents_verified_by_idx" on public."shop_documents" ("verified_by");
create index if not exists "shop_documents_created_at_idx" on public."shop_documents" ("created_at");
create index if not exists "shop_bank_accounts_shop_id_idx" on public."shop_bank_accounts" ("shop_id");
create index if not exists "shop_bank_accounts_created_at_idx" on public."shop_bank_accounts" ("created_at");
create index if not exists "shop_bank_accounts_updated_at_idx" on public."shop_bank_accounts" ("updated_at");
create index if not exists "categories_parent_id_idx" on public."categories" ("parent_id");
create index if not exists "categories_created_at_idx" on public."categories" ("created_at");
create index if not exists "categories_updated_at_idx" on public."categories" ("updated_at");
create index if not exists "products_shop_id_idx" on public."products" ("shop_id");
create index if not exists "products_category_id_idx" on public."products" ("category_id");
create index if not exists "products_created_at_idx" on public."products" ("created_at");
create index if not exists "products_updated_at_idx" on public."products" ("updated_at");
create index if not exists "product_images_product_id_idx" on public."product_images" ("product_id");
create index if not exists "product_images_variant_id_idx" on public."product_images" ("variant_id");
create index if not exists "product_images_created_at_idx" on public."product_images" ("created_at");
create index if not exists "product_variants_product_id_idx" on public."product_variants" ("product_id");
create index if not exists "product_variants_shop_id_idx" on public."product_variants" ("shop_id");
create index if not exists "product_variants_created_at_idx" on public."product_variants" ("created_at");
create index if not exists "product_variants_updated_at_idx" on public."product_variants" ("updated_at");
create index if not exists "variant_barcodes_variant_id_idx" on public."variant_barcodes" ("variant_id");
create index if not exists "variant_barcodes_created_by_idx" on public."variant_barcodes" ("created_by");
create index if not exists "variant_barcodes_created_at_idx" on public."variant_barcodes" ("created_at");
create index if not exists "inventory_balances_shop_id_idx" on public."inventory_balances" ("shop_id");
create index if not exists "inventory_balances_variant_id_idx" on public."inventory_balances" ("variant_id");
create index if not exists "inventory_balances_updated_at_idx" on public."inventory_balances" ("updated_at");
create index if not exists "inventory_movements_shop_id_idx" on public."inventory_movements" ("shop_id");
create index if not exists "inventory_movements_variant_id_idx" on public."inventory_movements" ("variant_id");
create index if not exists "inventory_movements_performed_by_idx" on public."inventory_movements" ("performed_by");
create index if not exists "inventory_movements_created_at_idx" on public."inventory_movements" ("created_at");
create index if not exists "inventory_reservations_shop_id_idx" on public."inventory_reservations" ("shop_id");
create index if not exists "inventory_reservations_variant_id_idx" on public."inventory_reservations" ("variant_id");
create index if not exists "inventory_reservations_cart_id_idx" on public."inventory_reservations" ("cart_id");
create index if not exists "inventory_reservations_order_id_idx" on public."inventory_reservations" ("order_id");
create index if not exists "inventory_reservations_status_idx" on public."inventory_reservations" ("status");
create index if not exists "inventory_reservations_created_at_idx" on public."inventory_reservations" ("created_at");
create index if not exists "product_photo_matches_shop_id_idx" on public."product_photo_matches" ("shop_id");
create index if not exists "product_photo_matches_uploaded_by_idx" on public."product_photo_matches" ("uploaded_by");
create index if not exists "product_photo_matches_matched_variant_id_idx" on public."product_photo_matches" ("matched_variant_id");
create index if not exists "product_photo_matches_created_at_idx" on public."product_photo_matches" ("created_at");
create index if not exists "shop_favourites_customer_id_idx" on public."shop_favourites" ("customer_id");
create index if not exists "shop_favourites_shop_id_idx" on public."shop_favourites" ("shop_id");
create index if not exists "wishlist_items_customer_id_idx" on public."wishlist_items" ("customer_id");
create index if not exists "wishlist_items_product_id_idx" on public."wishlist_items" ("product_id");
create index if not exists "wishlist_items_variant_id_idx" on public."wishlist_items" ("variant_id");
create index if not exists "wishlist_items_created_at_idx" on public."wishlist_items" ("created_at");
create index if not exists "shop_collections_shop_id_idx" on public."shop_collections" ("shop_id");
create index if not exists "shop_collections_created_at_idx" on public."shop_collections" ("created_at");
create index if not exists "shop_collections_updated_at_idx" on public."shop_collections" ("updated_at");
create index if not exists "shop_collection_items_collection_id_idx" on public."shop_collection_items" ("collection_id");
create index if not exists "shop_collection_items_product_id_idx" on public."shop_collection_items" ("product_id");
create index if not exists "shop_collection_items_variant_id_idx" on public."shop_collection_items" ("variant_id");
create index if not exists "shop_collection_items_created_at_idx" on public."shop_collection_items" ("created_at");
create index if not exists "offers_shop_id_idx" on public."offers" ("shop_id");
create index if not exists "offers_status_idx" on public."offers" ("status");
create index if not exists "offers_created_at_idx" on public."offers" ("created_at");
create index if not exists "offers_updated_at_idx" on public."offers" ("updated_at");
create index if not exists "offer_products_offer_id_idx" on public."offer_products" ("offer_id");
create index if not exists "offer_products_product_id_idx" on public."offer_products" ("product_id");
create index if not exists "offer_products_variant_id_idx" on public."offer_products" ("variant_id");
create index if not exists "offer_products_created_at_idx" on public."offer_products" ("created_at");
create index if not exists "offer_redemptions_offer_id_idx" on public."offer_redemptions" ("offer_id");
create index if not exists "offer_redemptions_customer_id_idx" on public."offer_redemptions" ("customer_id");
create index if not exists "offer_redemptions_order_id_idx" on public."offer_redemptions" ("order_id");
create index if not exists "offer_redemptions_created_at_idx" on public."offer_redemptions" ("created_at");
create index if not exists "offline_sales_shop_id_idx" on public."offline_sales" ("shop_id");
create index if not exists "offline_sales_merchant_id_idx" on public."offline_sales" ("merchant_id");
create index if not exists "offline_sales_status_idx" on public."offline_sales" ("status");
create index if not exists "offline_sales_recorded_by_idx" on public."offline_sales" ("recorded_by");
create index if not exists "offline_sales_created_at_idx" on public."offline_sales" ("created_at");
create index if not exists "offline_sale_items_offline_sale_id_idx" on public."offline_sale_items" ("offline_sale_id");
create index if not exists "offline_sale_items_variant_id_idx" on public."offline_sale_items" ("variant_id");
create index if not exists "offline_sale_items_created_at_idx" on public."offline_sale_items" ("created_at");
create index if not exists "carts_customer_id_idx" on public."carts" ("customer_id");
create index if not exists "carts_shop_id_idx" on public."carts" ("shop_id");
create index if not exists "carts_status_idx" on public."carts" ("status");
create index if not exists "carts_created_at_idx" on public."carts" ("created_at");
create index if not exists "carts_updated_at_idx" on public."carts" ("updated_at");
create index if not exists "cart_items_cart_id_idx" on public."cart_items" ("cart_id");
create index if not exists "cart_items_variant_id_idx" on public."cart_items" ("variant_id");
create index if not exists "cart_items_updated_at_idx" on public."cart_items" ("updated_at");
create index if not exists "orders_customer_id_idx" on public."orders" ("customer_id");
create index if not exists "orders_shop_id_idx" on public."orders" ("shop_id");
create index if not exists "orders_cart_id_idx" on public."orders" ("cart_id");
create index if not exists "orders_style_group_id_idx" on public."orders" ("style_group_id");
create index if not exists "orders_delivery_address_id_idx" on public."orders" ("delivery_address_id");
create index if not exists "orders_status_idx" on public."orders" ("status");
create index if not exists "orders_created_at_idx" on public."orders" ("created_at");
create index if not exists "orders_updated_at_idx" on public."orders" ("updated_at");
create index if not exists "order_items_order_id_idx" on public."order_items" ("order_id");
create index if not exists "order_items_product_id_idx" on public."order_items" ("product_id");
create index if not exists "order_items_variant_id_idx" on public."order_items" ("variant_id");
create index if not exists "order_items_created_at_idx" on public."order_items" ("created_at");
create index if not exists "order_status_history_order_id_idx" on public."order_status_history" ("order_id");
create index if not exists "order_status_history_changed_by_user_id_idx" on public."order_status_history" ("changed_by_user_id");
create index if not exists "order_status_history_created_at_idx" on public."order_status_history" ("created_at");
create index if not exists "merchant_order_alerts_order_id_idx" on public."merchant_order_alerts" ("order_id");
create index if not exists "merchant_order_alerts_shop_id_idx" on public."merchant_order_alerts" ("shop_id");
create index if not exists "merchant_order_alerts_device_id_idx" on public."merchant_order_alerts" ("device_id");
create index if not exists "merchant_order_alerts_acknowledged_by_idx" on public."merchant_order_alerts" ("acknowledged_by");
create index if not exists "merchant_order_alerts_created_at_idx" on public."merchant_order_alerts" ("created_at");
create index if not exists "merchant_order_issues_order_id_idx" on public."merchant_order_issues" ("order_id");
create index if not exists "merchant_order_issues_order_item_id_idx" on public."merchant_order_issues" ("order_item_id");
create index if not exists "merchant_order_issues_reported_by_idx" on public."merchant_order_issues" ("reported_by");
create index if not exists "merchant_order_issues_resolved_by_idx" on public."merchant_order_issues" ("resolved_by");
create index if not exists "merchant_order_issues_created_at_idx" on public."merchant_order_issues" ("created_at");
create index if not exists "order_item_verifications_order_item_id_idx" on public."order_item_verifications" ("order_item_id");
create index if not exists "order_item_verifications_verified_variant_id_idx" on public."order_item_verifications" ("verified_variant_id");
create index if not exists "order_item_verifications_verified_by_idx" on public."order_item_verifications" ("verified_by");
create index if not exists "payments_order_id_idx" on public."payments" ("order_id");
create index if not exists "payments_customer_id_idx" on public."payments" ("customer_id");
create index if not exists "payments_status_idx" on public."payments" ("status");
create index if not exists "payments_created_at_idx" on public."payments" ("created_at");
create index if not exists "payments_updated_at_idx" on public."payments" ("updated_at");
create index if not exists "payment_events_payment_id_idx" on public."payment_events" ("payment_id");
create index if not exists "return_requests_order_id_idx" on public."return_requests" ("order_id");
create index if not exists "return_requests_customer_id_idx" on public."return_requests" ("customer_id");
create index if not exists "return_requests_shop_id_idx" on public."return_requests" ("shop_id");
create index if not exists "return_requests_status_idx" on public."return_requests" ("status");
create index if not exists "return_requests_created_at_idx" on public."return_requests" ("created_at");
create index if not exists "return_requests_updated_at_idx" on public."return_requests" ("updated_at");
create index if not exists "return_items_return_request_id_idx" on public."return_items" ("return_request_id");
create index if not exists "return_items_order_item_id_idx" on public."return_items" ("order_item_id");
create index if not exists "return_items_inspected_by_idx" on public."return_items" ("inspected_by");
create index if not exists "return_evidence_return_request_id_idx" on public."return_evidence" ("return_request_id");
create index if not exists "return_evidence_uploaded_by_idx" on public."return_evidence" ("uploaded_by");
create index if not exists "return_evidence_created_at_idx" on public."return_evidence" ("created_at");
create index if not exists "return_status_history_return_request_id_idx" on public."return_status_history" ("return_request_id");
create index if not exists "return_status_history_changed_by_idx" on public."return_status_history" ("changed_by");
create index if not exists "return_status_history_created_at_idx" on public."return_status_history" ("created_at");
create index if not exists "refunds_order_id_idx" on public."refunds" ("order_id");
create index if not exists "refunds_payment_id_idx" on public."refunds" ("payment_id");
create index if not exists "refunds_return_request_id_idx" on public."refunds" ("return_request_id");
create index if not exists "refunds_status_idx" on public."refunds" ("status");
create index if not exists "refunds_initiated_by_idx" on public."refunds" ("initiated_by");
create index if not exists "refunds_approved_by_idx" on public."refunds" ("approved_by");
create index if not exists "refunds_created_at_idx" on public."refunds" ("created_at");
create index if not exists "refunds_updated_at_idx" on public."refunds" ("updated_at");
create index if not exists "merchant_settlements_shop_id_idx" on public."merchant_settlements" ("shop_id");
create index if not exists "merchant_settlements_bank_account_id_idx" on public."merchant_settlements" ("bank_account_id");
create index if not exists "merchant_settlements_status_idx" on public."merchant_settlements" ("status");
create index if not exists "merchant_settlements_created_at_idx" on public."merchant_settlements" ("created_at");
create index if not exists "merchant_settlements_updated_at_idx" on public."merchant_settlements" ("updated_at");
create index if not exists "merchant_settlement_items_settlement_id_idx" on public."merchant_settlement_items" ("settlement_id");
create index if not exists "merchant_settlement_items_order_id_idx" on public."merchant_settlement_items" ("order_id");
create index if not exists "merchant_settlement_items_refund_id_idx" on public."merchant_settlement_items" ("refund_id");
create index if not exists "merchant_settlement_items_created_at_idx" on public."merchant_settlement_items" ("created_at");
create index if not exists "captain_documents_captain_id_idx" on public."captain_documents" ("captain_id");
create index if not exists "captain_documents_verified_by_idx" on public."captain_documents" ("verified_by");
create index if not exists "captain_documents_created_at_idx" on public."captain_documents" ("created_at");
create index if not exists "delivery_tasks_order_id_idx" on public."delivery_tasks" ("order_id");
create index if not exists "delivery_tasks_return_request_id_idx" on public."delivery_tasks" ("return_request_id");
create index if not exists "delivery_tasks_pickup_shop_id_idx" on public."delivery_tasks" ("pickup_shop_id");
create index if not exists "delivery_tasks_status_idx" on public."delivery_tasks" ("status");
create index if not exists "delivery_tasks_assigned_captain_id_idx" on public."delivery_tasks" ("assigned_captain_id");
create index if not exists "delivery_tasks_created_at_idx" on public."delivery_tasks" ("created_at");
create index if not exists "delivery_tasks_updated_at_idx" on public."delivery_tasks" ("updated_at");
create index if not exists "delivery_assignments_delivery_task_id_idx" on public."delivery_assignments" ("delivery_task_id");
create index if not exists "delivery_assignments_captain_id_idx" on public."delivery_assignments" ("captain_id");
create index if not exists "delivery_assignments_assigned_by_user_id_idx" on public."delivery_assignments" ("assigned_by_user_id");
create index if not exists "delivery_assignments_created_at_idx" on public."delivery_assignments" ("created_at");
create index if not exists "captain_current_locations_captain_id_idx" on public."captain_current_locations" ("captain_id");
create index if not exists "captain_current_locations_active_delivery_task_id_idx" on public."captain_current_locations" ("active_delivery_task_id");
create index if not exists "captain_current_locations_updated_at_idx" on public."captain_current_locations" ("updated_at");
create index if not exists "captain_location_history_captain_id_idx" on public."captain_location_history" ("captain_id");
create index if not exists "captain_location_history_delivery_task_id_idx" on public."captain_location_history" ("delivery_task_id");
create index if not exists "delivery_events_delivery_task_id_idx" on public."delivery_events" ("delivery_task_id");
create index if not exists "delivery_events_actor_user_id_idx" on public."delivery_events" ("actor_user_id");
create index if not exists "delivery_events_created_at_idx" on public."delivery_events" ("created_at");
create index if not exists "cod_collections_order_id_idx" on public."cod_collections" ("order_id");
create index if not exists "cod_collections_delivery_task_id_idx" on public."cod_collections" ("delivery_task_id");
create index if not exists "cod_collections_captain_id_idx" on public."cod_collections" ("captain_id");
create index if not exists "cod_collections_status_idx" on public."cod_collections" ("status");
create index if not exists "cod_collections_reconciled_by_idx" on public."cod_collections" ("reconciled_by");
create index if not exists "cod_collections_created_at_idx" on public."cod_collections" ("created_at");
create index if not exists "captain_earnings_captain_id_idx" on public."captain_earnings" ("captain_id");
create index if not exists "captain_earnings_delivery_task_id_idx" on public."captain_earnings" ("delivery_task_id");
create index if not exists "captain_earnings_status_idx" on public."captain_earnings" ("status");
create index if not exists "captain_earnings_created_at_idx" on public."captain_earnings" ("created_at");
create index if not exists "captain_payouts_captain_id_idx" on public."captain_payouts" ("captain_id");
create index if not exists "captain_payouts_status_idx" on public."captain_payouts" ("status");
create index if not exists "captain_payouts_created_at_idx" on public."captain_payouts" ("created_at");
create index if not exists "captain_payouts_updated_at_idx" on public."captain_payouts" ("updated_at");
create index if not exists "captain_payout_items_payout_id_idx" on public."captain_payout_items" ("payout_id");
create index if not exists "captain_payout_items_captain_earning_id_idx" on public."captain_payout_items" ("captain_earning_id");
create index if not exists "captain_payout_items_created_at_idx" on public."captain_payout_items" ("created_at");
create index if not exists "style_groups_creator_customer_id_idx" on public."style_groups" ("creator_customer_id");
create index if not exists "style_groups_status_idx" on public."style_groups" ("status");
create index if not exists "style_groups_created_at_idx" on public."style_groups" ("created_at");
create index if not exists "style_groups_updated_at_idx" on public."style_groups" ("updated_at");
create index if not exists "style_group_members_group_id_idx" on public."style_group_members" ("group_id");
create index if not exists "style_group_members_customer_id_idx" on public."style_group_members" ("customer_id");
create index if not exists "style_group_members_status_idx" on public."style_group_members" ("status");
create index if not exists "style_group_members_created_at_idx" on public."style_group_members" ("created_at");
create index if not exists "style_group_member_preferences_group_member_id_idx" on public."style_group_member_preferences" ("group_member_id");
create index if not exists "style_group_member_preferences_private_body_profile_id_idx" on public."style_group_member_preferences" ("private_body_profile_id");
create index if not exists "style_group_member_preferences_updated_at_idx" on public."style_group_member_preferences" ("updated_at");
create index if not exists "style_themes_group_id_idx" on public."style_themes" ("group_id");
create index if not exists "style_themes_created_by_idx" on public."style_themes" ("created_by");
create index if not exists "style_themes_created_at_idx" on public."style_themes" ("created_at");
create index if not exists "style_themes_updated_at_idx" on public."style_themes" ("updated_at");
create index if not exists "style_polls_group_id_idx" on public."style_polls" ("group_id");
create index if not exists "style_polls_status_idx" on public."style_polls" ("status");
create index if not exists "style_polls_created_by_idx" on public."style_polls" ("created_by");
create index if not exists "style_polls_created_at_idx" on public."style_polls" ("created_at");
create index if not exists "style_poll_options_poll_id_idx" on public."style_poll_options" ("poll_id");
create index if not exists "style_poll_options_product_id_idx" on public."style_poll_options" ("product_id");
create index if not exists "style_poll_options_theme_id_idx" on public."style_poll_options" ("theme_id");
create index if not exists "style_poll_options_created_at_idx" on public."style_poll_options" ("created_at");
create index if not exists "style_poll_votes_poll_id_idx" on public."style_poll_votes" ("poll_id");
create index if not exists "style_poll_votes_option_id_idx" on public."style_poll_votes" ("option_id");
create index if not exists "style_poll_votes_group_member_id_idx" on public."style_poll_votes" ("group_member_id");
create index if not exists "style_poll_votes_created_at_idx" on public."style_poll_votes" ("created_at");
create index if not exists "style_moodboards_group_id_idx" on public."style_moodboards" ("group_id");
create index if not exists "style_moodboards_theme_id_idx" on public."style_moodboards" ("theme_id");
create index if not exists "style_moodboards_status_idx" on public."style_moodboards" ("status");
create index if not exists "style_moodboards_created_by_idx" on public."style_moodboards" ("created_by");
create index if not exists "style_moodboards_created_at_idx" on public."style_moodboards" ("created_at");
create index if not exists "style_moodboards_updated_at_idx" on public."style_moodboards" ("updated_at");
create index if not exists "style_moodboard_items_moodboard_id_idx" on public."style_moodboard_items" ("moodboard_id");
create index if not exists "style_moodboard_items_group_member_id_idx" on public."style_moodboard_items" ("group_member_id");
create index if not exists "style_moodboard_items_product_id_idx" on public."style_moodboard_items" ("product_id");
create index if not exists "style_moodboard_items_variant_id_idx" on public."style_moodboard_items" ("variant_id");
create index if not exists "style_moodboard_items_created_at_idx" on public."style_moodboard_items" ("created_at");
create index if not exists "notifications_user_id_idx" on public."notifications" ("user_id");
create index if not exists "notifications_created_at_idx" on public."notifications" ("created_at");
create index if not exists "notification_deliveries_notification_id_idx" on public."notification_deliveries" ("notification_id");
create index if not exists "notification_deliveries_device_id_idx" on public."notification_deliveries" ("device_id");
create index if not exists "notification_deliveries_status_idx" on public."notification_deliveries" ("status");
create index if not exists "notification_deliveries_created_at_idx" on public."notification_deliveries" ("created_at");
create index if not exists "notification_preferences_user_id_idx" on public."notification_preferences" ("user_id");
create index if not exists "notification_preferences_updated_at_idx" on public."notification_preferences" ("updated_at");
create index if not exists "reviews_order_id_idx" on public."reviews" ("order_id");
create index if not exists "reviews_customer_id_idx" on public."reviews" ("customer_id");
create index if not exists "reviews_shop_id_idx" on public."reviews" ("shop_id");
create index if not exists "reviews_product_id_idx" on public."reviews" ("product_id");
create index if not exists "reviews_captain_id_idx" on public."reviews" ("captain_id");
create index if not exists "reviews_created_at_idx" on public."reviews" ("created_at");
create index if not exists "reviews_updated_at_idx" on public."reviews" ("updated_at");
create index if not exists "customer_events_customer_id_idx" on public."customer_events" ("customer_id");
create index if not exists "customer_events_shop_id_idx" on public."customer_events" ("shop_id");
create index if not exists "recommendation_sets_customer_id_idx" on public."recommendation_sets" ("customer_id");
create index if not exists "recommendation_items_recommendation_set_id_idx" on public."recommendation_items" ("recommendation_set_id");
create index if not exists "recommendation_items_product_id_idx" on public."recommendation_items" ("product_id");
create index if not exists "recommendation_items_variant_id_idx" on public."recommendation_items" ("variant_id");
create index if not exists "recommendation_items_created_at_idx" on public."recommendation_items" ("created_at");
create index if not exists "product_embeddings_product_id_idx" on public."product_embeddings" ("product_id");
create index if not exists "product_embeddings_updated_at_idx" on public."product_embeddings" ("updated_at");
create index if not exists "customer_embeddings_customer_id_idx" on public."customer_embeddings" ("customer_id");
create index if not exists "customer_embeddings_updated_at_idx" on public."customer_embeddings" ("updated_at");
create index if not exists "size_charts_shop_id_idx" on public."size_charts" ("shop_id");
create index if not exists "size_charts_category_id_idx" on public."size_charts" ("category_id");
create index if not exists "size_charts_created_at_idx" on public."size_charts" ("created_at");
create index if not exists "size_charts_updated_at_idx" on public."size_charts" ("updated_at");
create index if not exists "size_chart_measurements_size_chart_id_idx" on public."size_chart_measurements" ("size_chart_id");
create index if not exists "size_chart_measurements_created_at_idx" on public."size_chart_measurements" ("created_at");
create index if not exists "customer_body_profiles_customer_id_idx" on public."customer_body_profiles" ("customer_id");
create index if not exists "customer_body_profiles_created_at_idx" on public."customer_body_profiles" ("created_at");
create index if not exists "customer_body_profiles_updated_at_idx" on public."customer_body_profiles" ("updated_at");
create index if not exists "body_measurements_body_profile_id_idx" on public."body_measurements" ("body_profile_id");
create index if not exists "body_scan_sessions_customer_id_idx" on public."body_scan_sessions" ("customer_id");
create index if not exists "body_scan_sessions_body_profile_id_idx" on public."body_scan_sessions" ("body_profile_id");
create index if not exists "body_scan_sessions_status_idx" on public."body_scan_sessions" ("status");
create index if not exists "body_scan_sessions_created_at_idx" on public."body_scan_sessions" ("created_at");
create index if not exists "fit_recommendations_customer_id_idx" on public."fit_recommendations" ("customer_id");
create index if not exists "fit_recommendations_body_profile_id_idx" on public."fit_recommendations" ("body_profile_id");
create index if not exists "fit_recommendations_product_id_idx" on public."fit_recommendations" ("product_id");
create index if not exists "fit_recommendations_variant_id_idx" on public."fit_recommendations" ("variant_id");
create index if not exists "fit_recommendations_created_at_idx" on public."fit_recommendations" ("created_at");
create index if not exists "fit_feedback_customer_id_idx" on public."fit_feedback" ("customer_id");
create index if not exists "fit_feedback_order_item_id_idx" on public."fit_feedback" ("order_item_id");
create index if not exists "fit_feedback_fit_recommendation_id_idx" on public."fit_feedback" ("fit_recommendation_id");
create index if not exists "fit_feedback_created_at_idx" on public."fit_feedback" ("created_at");
create index if not exists "virtual_tryon_sessions_customer_id_idx" on public."virtual_tryon_sessions" ("customer_id");
create index if not exists "virtual_tryon_sessions_product_id_idx" on public."virtual_tryon_sessions" ("product_id");
create index if not exists "virtual_tryon_sessions_variant_id_idx" on public."virtual_tryon_sessions" ("variant_id");
create index if not exists "virtual_tryon_sessions_body_profile_id_idx" on public."virtual_tryon_sessions" ("body_profile_id");
create index if not exists "virtual_tryon_sessions_status_idx" on public."virtual_tryon_sessions" ("status");
create index if not exists "virtual_tryon_sessions_created_at_idx" on public."virtual_tryon_sessions" ("created_at");
create index if not exists "virtual_tryon_outputs_tryon_session_id_idx" on public."virtual_tryon_outputs" ("tryon_session_id");
create index if not exists "virtual_tryon_outputs_created_at_idx" on public."virtual_tryon_outputs" ("created_at");
create index if not exists "style_recommendation_sets_group_id_idx" on public."style_recommendation_sets" ("group_id");
create index if not exists "style_recommendation_sets_theme_id_idx" on public."style_recommendation_sets" ("theme_id");
create index if not exists "style_recommendation_sets_status_idx" on public."style_recommendation_sets" ("status");
create index if not exists "style_recommendation_sets_created_at_idx" on public."style_recommendation_sets" ("created_at");
create index if not exists "style_recommendation_items_recommendation_set_id_idx" on public."style_recommendation_items" ("recommendation_set_id");
create index if not exists "style_recommendation_items_group_member_id_idx" on public."style_recommendation_items" ("group_member_id");
create index if not exists "style_recommendation_items_product_id_idx" on public."style_recommendation_items" ("product_id");
create index if not exists "style_recommendation_items_variant_id_idx" on public."style_recommendation_items" ("variant_id");
create index if not exists "style_recommendation_items_created_at_idx" on public."style_recommendation_items" ("created_at");
create index if not exists "support_tickets_raised_by_user_id_idx" on public."support_tickets" ("raised_by_user_id");
create index if not exists "support_tickets_order_id_idx" on public."support_tickets" ("order_id");
create index if not exists "support_tickets_shop_id_idx" on public."support_tickets" ("shop_id");
create index if not exists "support_tickets_delivery_task_id_idx" on public."support_tickets" ("delivery_task_id");
create index if not exists "support_tickets_return_request_id_idx" on public."support_tickets" ("return_request_id");
create index if not exists "support_tickets_status_idx" on public."support_tickets" ("status");
create index if not exists "support_tickets_assigned_to_idx" on public."support_tickets" ("assigned_to");
create index if not exists "support_tickets_created_at_idx" on public."support_tickets" ("created_at");
create index if not exists "support_tickets_updated_at_idx" on public."support_tickets" ("updated_at");
create index if not exists "support_messages_ticket_id_idx" on public."support_messages" ("ticket_id");
create index if not exists "support_messages_sender_id_idx" on public."support_messages" ("sender_id");
create index if not exists "support_messages_created_at_idx" on public."support_messages" ("created_at");
create index if not exists "campaigns_status_idx" on public."campaigns" ("status");
create index if not exists "campaigns_created_by_idx" on public."campaigns" ("created_by");
create index if not exists "campaigns_approved_by_idx" on public."campaigns" ("approved_by");
create index if not exists "campaigns_created_at_idx" on public."campaigns" ("created_at");
create index if not exists "campaigns_updated_at_idx" on public."campaigns" ("updated_at");
create index if not exists "banners_campaign_id_idx" on public."banners" ("campaign_id");
create index if not exists "banners_created_at_idx" on public."banners" ("created_at");
create index if not exists "merchant_leads_assigned_executive_id_idx" on public."merchant_leads" ("assigned_executive_id");
create index if not exists "merchant_leads_created_at_idx" on public."merchant_leads" ("created_at");
create index if not exists "merchant_leads_updated_at_idx" on public."merchant_leads" ("updated_at");
create index if not exists "field_visits_merchant_lead_id_idx" on public."field_visits" ("merchant_lead_id");
create index if not exists "field_visits_shop_id_idx" on public."field_visits" ("shop_id");
create index if not exists "field_visits_executive_id_idx" on public."field_visits" ("executive_id");
create index if not exists "field_visits_status_idx" on public."field_visits" ("status");
create index if not exists "field_visits_created_at_idx" on public."field_visits" ("created_at");
create index if not exists "field_visits_updated_at_idx" on public."field_visits" ("updated_at");
create index if not exists "field_visit_checklist_items_field_visit_id_idx" on public."field_visit_checklist_items" ("field_visit_id");
create index if not exists "field_visit_checklist_items_completed_by_idx" on public."field_visit_checklist_items" ("completed_by");
create index if not exists "product_moderation_cases_product_id_idx" on public."product_moderation_cases" ("product_id");
create index if not exists "product_moderation_cases_status_idx" on public."product_moderation_cases" ("status");
create index if not exists "product_moderation_cases_moderator_id_idx" on public."product_moderation_cases" ("moderator_id");
create index if not exists "product_moderation_cases_created_at_idx" on public."product_moderation_cases" ("created_at");
create index if not exists "approval_requests_requested_by_idx" on public."approval_requests" ("requested_by");
create index if not exists "approval_requests_status_idx" on public."approval_requests" ("status");
create index if not exists "approval_requests_approved_by_idx" on public."approval_requests" ("approved_by");
create index if not exists "approval_requests_created_at_idx" on public."approval_requests" ("created_at");
create index if not exists "fraud_cases_subject_user_id_idx" on public."fraud_cases" ("subject_user_id");
create index if not exists "fraud_cases_shop_id_idx" on public."fraud_cases" ("shop_id");
create index if not exists "fraud_cases_order_id_idx" on public."fraud_cases" ("order_id");
create index if not exists "fraud_cases_status_idx" on public."fraud_cases" ("status");
create index if not exists "fraud_cases_assigned_to_idx" on public."fraud_cases" ("assigned_to");
create index if not exists "fraud_cases_created_at_idx" on public."fraud_cases" ("created_at");
create index if not exists "audit_logs_actor_user_id_idx" on public."audit_logs" ("actor_user_id");
create index if not exists "audit_logs_device_id_idx" on public."audit_logs" ("device_id");
create index if not exists "audit_logs_created_at_idx" on public."audit_logs" ("created_at");
create index if not exists "system_settings_updated_by_idx" on public."system_settings" ("updated_by");
create index if not exists "system_settings_updated_at_idx" on public."system_settings" ("updated_at");
create index if not exists "service_zones_city_idx" on public."service_zones" ("city");
create index if not exists "service_zones_created_at_idx" on public."service_zones" ("created_at");
create index if not exists "service_zones_updated_at_idx" on public."service_zones" ("updated_at");
create index if not exists "shops_location_gist" on public."shops" using gist ("location");
create index if not exists "service_zones_boundary_gist" on public."service_zones" using gist ("boundary");
create index if not exists "delivery_tasks_pickup_location_gist" on public."delivery_tasks" using gist ("pickup_location");
create index if not exists "delivery_tasks_drop_location_gist" on public."delivery_tasks" using gist ("drop_location");
create index if not exists "captain_current_locations_location_gist" on public."captain_current_locations" using gist ("location");
create index if not exists "captain_location_history_location_gist" on public."captain_location_history" using gist ("location");
create index if not exists "field_visits_start_location_gist" on public."field_visits" using gist ("start_location");
create index if not exists products_search_vector_gin on public.products using gin (search_vector);
create index if not exists products_style_tags_gin on public.products using gin (style_tags);
create index if not exists products_occasion_tags_gin on public.products using gin (occasion_tags);
create index if not exists products_name_trgm on public.products using gin (name gin_trgm_ops);
create index if not exists shops_name_trgm on public.shops using gin (name gin_trgm_ops);
create index if not exists inventory_available_lookup on public.inventory_balances (shop_id, variant_id, stock_on_hand, reserved_quantity, damaged_quantity);
create index if not exists active_orders_shop_status on public.orders (shop_id, status, created_at desc);
create index if not exists customer_orders_recent on public.orders (customer_id, created_at desc);
create index if not exists pending_alerts on public.merchant_order_alerts (shop_id, alert_status, expires_at);
create index if not exists dispatch_candidates on public.captain_profiles (availability_status) where availability_status = 'AVAILABLE';
create index if not exists customer_events_customer_time on public.customer_events (customer_id, occurred_at desc);
create index if not exists audit_logs_entity_time on public.audit_logs (entity_type, entity_id, created_at desc);

-- Storage buckets. Run from a privileged migration or create in Dashboard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images','product-images',true,10485760,array['image/jpeg','image/png','image/webp']),
  ('shop-images','shop-images',true,10485760,array['image/jpeg','image/png','image/webp']),
  ('merchant-documents','merchant-documents',false,15728640,array['image/jpeg','image/png','application/pdf']),
  ('captain-documents','captain-documents',false,15728640,array['image/jpeg','image/png','application/pdf']),
  ('return-evidence','return-evidence',false,26214400,array['image/jpeg','image/png','image/webp','video/mp4']),
  ('body-scans','body-scans',false,26214400,array['image/jpeg','image/png','image/webp']),
  ('virtual-tryon','virtual-tryon',false,26214400,array['image/jpeg','image/png','image/webp']),
  ('support-attachments','support-attachments',false,26214400,array['image/jpeg','image/png','application/pdf','video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for catalogue media only. Uploads remain authenticated and path-scoped.
drop policy if exists "public product images read" on storage.objects;
create policy "public product images read" on storage.objects for select to anon, authenticated
using (bucket_id in ('product-images','shop-images'));

drop policy if exists "authenticated product media upload" on storage.objects;
create policy "authenticated product media upload" on storage.objects for insert to authenticated
with check (
  bucket_id in ('product-images','shop-images')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "owner manages uploaded product media" on storage.objects;
create policy "owner manages uploaded product media" on storage.objects for update to authenticated
using (owner_id = (select auth.uid())::text)
with check (owner_id = (select auth.uid())::text);

drop policy if exists "owner deletes uploaded product media" on storage.objects;
create policy "owner deletes uploaded product media" on storage.objects for delete to authenticated
using (owner_id = (select auth.uid())::text);

-- Private uploads are stored under the authenticated user's first folder segment.
drop policy if exists "private bucket owner upload" on storage.objects;
create policy "private bucket owner upload" on storage.objects for insert to authenticated
with check (
  bucket_id in ('merchant-documents','captain-documents','return-evidence','body-scans','virtual-tryon','support-attachments')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "private bucket owner read" on storage.objects;
create policy "private bucket owner read" on storage.objects for select to authenticated
using (
  bucket_id in ('merchant-documents','captain-documents','return-evidence','body-scans','virtual-tryon','support-attachments')
  and owner_id = (select auth.uid())::text
);

drop policy if exists "private bucket owner delete" on storage.objects;
create policy "private bucket owner delete" on storage.objects for delete to authenticated
using (
  bucket_id in ('merchant-documents','captain-documents','return-evidence','body-scans','virtual-tryon','support-attachments')
  and owner_id = (select auth.uid())::text
);

-- Realtime publication. Foreground UI subscribes to these tables; background ringing still needs FCM/APNs.
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;
do $$ begin alter publication supabase_realtime add table public.order_status_history; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.merchant_order_alerts; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.delivery_tasks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.delivery_events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.support_messages; exception when duplicate_object then null; end $$;

