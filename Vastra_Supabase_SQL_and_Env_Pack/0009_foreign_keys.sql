-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


-- Foreign keys are applied after every table exists.

alter table public."profiles" drop constraint if exists "profiles_id_fkey";
alter table public."profiles" add constraint "profiles_id_fkey" foreign key ("id") references auth.users ("id") on update cascade on delete restrict;

alter table public."user_devices" drop constraint if exists "user_devices_user_id_fkey";
alter table public."user_devices" add constraint "user_devices_user_id_fkey" foreign key ("user_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."addresses" drop constraint if exists "addresses_user_id_fkey";
alter table public."addresses" add constraint "addresses_user_id_fkey" foreign key ("user_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."customer_profiles" drop constraint if exists "customer_profiles_user_id_fkey";
alter table public."customer_profiles" add constraint "customer_profiles_user_id_fkey" foreign key ("user_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."customer_profiles" drop constraint if exists "customer_profiles_default_address_id_fkey";
alter table public."customer_profiles" add constraint "customer_profiles_default_address_id_fkey" foreign key ("default_address_id") references public."addresses" ("id") on update cascade on delete set null;

alter table public."customer_preferences" drop constraint if exists "customer_preferences_customer_id_fkey";
alter table public."customer_preferences" add constraint "customer_preferences_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."merchant_profiles" drop constraint if exists "merchant_profiles_user_id_fkey";
alter table public."merchant_profiles" add constraint "merchant_profiles_user_id_fkey" foreign key ("user_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."merchant_profiles" drop constraint if exists "merchant_profiles_approved_by_fkey";
alter table public."merchant_profiles" add constraint "merchant_profiles_approved_by_fkey" foreign key ("approved_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."captain_profiles" drop constraint if exists "captain_profiles_user_id_fkey";
alter table public."captain_profiles" add constraint "captain_profiles_user_id_fkey" foreign key ("user_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."admin_profiles" drop constraint if exists "admin_profiles_user_id_fkey";
alter table public."admin_profiles" add constraint "admin_profiles_user_id_fkey" foreign key ("user_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."admin_profiles" drop constraint if exists "admin_profiles_manager_id_fkey";
alter table public."admin_profiles" add constraint "admin_profiles_manager_id_fkey" foreign key ("manager_id") references public."admin_profiles" ("user_id") on update cascade on delete set null;

alter table public."user_roles" drop constraint if exists "user_roles_user_id_fkey";
alter table public."user_roles" add constraint "user_roles_user_id_fkey" foreign key ("user_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."user_roles" drop constraint if exists "user_roles_role_id_fkey";
alter table public."user_roles" add constraint "user_roles_role_id_fkey" foreign key ("role_id") references public."roles" ("id") on update cascade on delete restrict;

alter table public."user_roles" drop constraint if exists "user_roles_assigned_by_fkey";
alter table public."user_roles" add constraint "user_roles_assigned_by_fkey" foreign key ("assigned_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."role_permissions" drop constraint if exists "role_permissions_role_id_fkey";
alter table public."role_permissions" add constraint "role_permissions_role_id_fkey" foreign key ("role_id") references public."roles" ("id") on update cascade on delete restrict;

alter table public."role_permissions" drop constraint if exists "role_permissions_permission_id_fkey";
alter table public."role_permissions" add constraint "role_permissions_permission_id_fkey" foreign key ("permission_id") references public."permissions" ("id") on update cascade on delete restrict;

alter table public."shops" drop constraint if exists "shops_merchant_id_fkey";
alter table public."shops" add constraint "shops_merchant_id_fkey" foreign key ("merchant_id") references public."merchant_profiles" ("user_id") on update cascade on delete restrict;

alter table public."shop_hours" drop constraint if exists "shop_hours_shop_id_fkey";
alter table public."shop_hours" add constraint "shop_hours_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."shop_documents" drop constraint if exists "shop_documents_shop_id_fkey";
alter table public."shop_documents" add constraint "shop_documents_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."shop_documents" drop constraint if exists "shop_documents_uploaded_by_fkey";
alter table public."shop_documents" add constraint "shop_documents_uploaded_by_fkey" foreign key ("uploaded_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."shop_documents" drop constraint if exists "shop_documents_verified_by_fkey";
alter table public."shop_documents" add constraint "shop_documents_verified_by_fkey" foreign key ("verified_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."shop_bank_accounts" drop constraint if exists "shop_bank_accounts_shop_id_fkey";
alter table public."shop_bank_accounts" add constraint "shop_bank_accounts_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."categories" drop constraint if exists "categories_parent_id_fkey";
alter table public."categories" add constraint "categories_parent_id_fkey" foreign key ("parent_id") references public."categories" ("id") on update cascade on delete set null;

alter table public."products" drop constraint if exists "products_shop_id_fkey";
alter table public."products" add constraint "products_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."products" drop constraint if exists "products_category_id_fkey";
alter table public."products" add constraint "products_category_id_fkey" foreign key ("category_id") references public."categories" ("id") on update cascade on delete restrict;

alter table public."product_images" drop constraint if exists "product_images_product_id_fkey";
alter table public."product_images" add constraint "product_images_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."product_images" drop constraint if exists "product_images_variant_id_fkey";
alter table public."product_images" add constraint "product_images_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."product_variants" drop constraint if exists "product_variants_product_id_fkey";
alter table public."product_variants" add constraint "product_variants_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."product_variants" drop constraint if exists "product_variants_shop_id_fkey";
alter table public."product_variants" add constraint "product_variants_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."variant_barcodes" drop constraint if exists "variant_barcodes_variant_id_fkey";
alter table public."variant_barcodes" add constraint "variant_barcodes_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete restrict;

alter table public."variant_barcodes" drop constraint if exists "variant_barcodes_created_by_fkey";
alter table public."variant_barcodes" add constraint "variant_barcodes_created_by_fkey" foreign key ("created_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."inventory_balances" drop constraint if exists "inventory_balances_shop_id_fkey";
alter table public."inventory_balances" add constraint "inventory_balances_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."inventory_balances" drop constraint if exists "inventory_balances_variant_id_fkey";
alter table public."inventory_balances" add constraint "inventory_balances_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete restrict;

alter table public."inventory_movements" drop constraint if exists "inventory_movements_shop_id_fkey";
alter table public."inventory_movements" add constraint "inventory_movements_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."inventory_movements" drop constraint if exists "inventory_movements_variant_id_fkey";
alter table public."inventory_movements" add constraint "inventory_movements_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete restrict;

alter table public."inventory_movements" drop constraint if exists "inventory_movements_performed_by_fkey";
alter table public."inventory_movements" add constraint "inventory_movements_performed_by_fkey" foreign key ("performed_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."inventory_reservations" drop constraint if exists "inventory_reservations_shop_id_fkey";
alter table public."inventory_reservations" add constraint "inventory_reservations_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."inventory_reservations" drop constraint if exists "inventory_reservations_variant_id_fkey";
alter table public."inventory_reservations" add constraint "inventory_reservations_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete restrict;

alter table public."inventory_reservations" drop constraint if exists "inventory_reservations_cart_id_fkey";
alter table public."inventory_reservations" add constraint "inventory_reservations_cart_id_fkey" foreign key ("cart_id") references public."carts" ("id") on update cascade on delete set null;

alter table public."inventory_reservations" drop constraint if exists "inventory_reservations_order_id_fkey";
alter table public."inventory_reservations" add constraint "inventory_reservations_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete set null;

alter table public."product_photo_matches" drop constraint if exists "product_photo_matches_shop_id_fkey";
alter table public."product_photo_matches" add constraint "product_photo_matches_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."product_photo_matches" drop constraint if exists "product_photo_matches_uploaded_by_fkey";
alter table public."product_photo_matches" add constraint "product_photo_matches_uploaded_by_fkey" foreign key ("uploaded_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."product_photo_matches" drop constraint if exists "product_photo_matches_matched_variant_id_fkey";
alter table public."product_photo_matches" add constraint "product_photo_matches_matched_variant_id_fkey" foreign key ("matched_variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."shop_favourites" drop constraint if exists "shop_favourites_customer_id_fkey";
alter table public."shop_favourites" add constraint "shop_favourites_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."shop_favourites" drop constraint if exists "shop_favourites_shop_id_fkey";
alter table public."shop_favourites" add constraint "shop_favourites_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."wishlist_items" drop constraint if exists "wishlist_items_customer_id_fkey";
alter table public."wishlist_items" add constraint "wishlist_items_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."wishlist_items" drop constraint if exists "wishlist_items_product_id_fkey";
alter table public."wishlist_items" add constraint "wishlist_items_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."wishlist_items" drop constraint if exists "wishlist_items_variant_id_fkey";
alter table public."wishlist_items" add constraint "wishlist_items_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."shop_collections" drop constraint if exists "shop_collections_shop_id_fkey";
alter table public."shop_collections" add constraint "shop_collections_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."shop_collection_items" drop constraint if exists "shop_collection_items_collection_id_fkey";
alter table public."shop_collection_items" add constraint "shop_collection_items_collection_id_fkey" foreign key ("collection_id") references public."shop_collections" ("id") on update cascade on delete restrict;

alter table public."shop_collection_items" drop constraint if exists "shop_collection_items_product_id_fkey";
alter table public."shop_collection_items" add constraint "shop_collection_items_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."shop_collection_items" drop constraint if exists "shop_collection_items_variant_id_fkey";
alter table public."shop_collection_items" add constraint "shop_collection_items_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."offers" drop constraint if exists "offers_shop_id_fkey";
alter table public."offers" add constraint "offers_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."offer_products" drop constraint if exists "offer_products_offer_id_fkey";
alter table public."offer_products" add constraint "offer_products_offer_id_fkey" foreign key ("offer_id") references public."offers" ("id") on update cascade on delete restrict;

alter table public."offer_products" drop constraint if exists "offer_products_product_id_fkey";
alter table public."offer_products" add constraint "offer_products_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."offer_products" drop constraint if exists "offer_products_variant_id_fkey";
alter table public."offer_products" add constraint "offer_products_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."offer_redemptions" drop constraint if exists "offer_redemptions_offer_id_fkey";
alter table public."offer_redemptions" add constraint "offer_redemptions_offer_id_fkey" foreign key ("offer_id") references public."offers" ("id") on update cascade on delete restrict;

alter table public."offer_redemptions" drop constraint if exists "offer_redemptions_customer_id_fkey";
alter table public."offer_redemptions" add constraint "offer_redemptions_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."offer_redemptions" drop constraint if exists "offer_redemptions_order_id_fkey";
alter table public."offer_redemptions" add constraint "offer_redemptions_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete restrict;

alter table public."offline_sales" drop constraint if exists "offline_sales_shop_id_fkey";
alter table public."offline_sales" add constraint "offline_sales_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."offline_sales" drop constraint if exists "offline_sales_merchant_id_fkey";
alter table public."offline_sales" add constraint "offline_sales_merchant_id_fkey" foreign key ("merchant_id") references public."merchant_profiles" ("user_id") on update cascade on delete restrict;

alter table public."offline_sales" drop constraint if exists "offline_sales_recorded_by_fkey";
alter table public."offline_sales" add constraint "offline_sales_recorded_by_fkey" foreign key ("recorded_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."offline_sale_items" drop constraint if exists "offline_sale_items_offline_sale_id_fkey";
alter table public."offline_sale_items" add constraint "offline_sale_items_offline_sale_id_fkey" foreign key ("offline_sale_id") references public."offline_sales" ("id") on update cascade on delete cascade;

alter table public."offline_sale_items" drop constraint if exists "offline_sale_items_variant_id_fkey";
alter table public."offline_sale_items" add constraint "offline_sale_items_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete cascade;

alter table public."carts" drop constraint if exists "carts_customer_id_fkey";
alter table public."carts" add constraint "carts_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."carts" drop constraint if exists "carts_shop_id_fkey";
alter table public."carts" add constraint "carts_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."cart_items" drop constraint if exists "cart_items_cart_id_fkey";
alter table public."cart_items" add constraint "cart_items_cart_id_fkey" foreign key ("cart_id") references public."carts" ("id") on update cascade on delete cascade;

alter table public."cart_items" drop constraint if exists "cart_items_variant_id_fkey";
alter table public."cart_items" add constraint "cart_items_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete cascade;

alter table public."orders" drop constraint if exists "orders_customer_id_fkey";
alter table public."orders" add constraint "orders_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."orders" drop constraint if exists "orders_shop_id_fkey";
alter table public."orders" add constraint "orders_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."orders" drop constraint if exists "orders_cart_id_fkey";
alter table public."orders" add constraint "orders_cart_id_fkey" foreign key ("cart_id") references public."carts" ("id") on update cascade on delete set null;

alter table public."orders" drop constraint if exists "orders_style_group_id_fkey";
alter table public."orders" add constraint "orders_style_group_id_fkey" foreign key ("style_group_id") references public."style_groups" ("id") on update cascade on delete set null;

alter table public."orders" drop constraint if exists "orders_delivery_address_id_fkey";
alter table public."orders" add constraint "orders_delivery_address_id_fkey" foreign key ("delivery_address_id") references public."addresses" ("id") on update cascade on delete restrict;

alter table public."order_items" drop constraint if exists "order_items_order_id_fkey";
alter table public."order_items" add constraint "order_items_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete cascade;

alter table public."order_items" drop constraint if exists "order_items_product_id_fkey";
alter table public."order_items" add constraint "order_items_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete cascade;

alter table public."order_items" drop constraint if exists "order_items_variant_id_fkey";
alter table public."order_items" add constraint "order_items_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete cascade;

alter table public."order_status_history" drop constraint if exists "order_status_history_order_id_fkey";
alter table public."order_status_history" add constraint "order_status_history_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete restrict;

alter table public."order_status_history" drop constraint if exists "order_status_history_changed_by_user_id_fkey";
alter table public."order_status_history" add constraint "order_status_history_changed_by_user_id_fkey" foreign key ("changed_by_user_id") references public."profiles" ("id") on update cascade on delete set null;

alter table public."merchant_order_alerts" drop constraint if exists "merchant_order_alerts_order_id_fkey";
alter table public."merchant_order_alerts" add constraint "merchant_order_alerts_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete restrict;

alter table public."merchant_order_alerts" drop constraint if exists "merchant_order_alerts_shop_id_fkey";
alter table public."merchant_order_alerts" add constraint "merchant_order_alerts_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."merchant_order_alerts" drop constraint if exists "merchant_order_alerts_device_id_fkey";
alter table public."merchant_order_alerts" add constraint "merchant_order_alerts_device_id_fkey" foreign key ("device_id") references public."user_devices" ("id") on update cascade on delete set null;

alter table public."merchant_order_alerts" drop constraint if exists "merchant_order_alerts_acknowledged_by_fkey";
alter table public."merchant_order_alerts" add constraint "merchant_order_alerts_acknowledged_by_fkey" foreign key ("acknowledged_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."merchant_order_issues" drop constraint if exists "merchant_order_issues_order_id_fkey";
alter table public."merchant_order_issues" add constraint "merchant_order_issues_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete restrict;

alter table public."merchant_order_issues" drop constraint if exists "merchant_order_issues_order_item_id_fkey";
alter table public."merchant_order_issues" add constraint "merchant_order_issues_order_item_id_fkey" foreign key ("order_item_id") references public."order_items" ("id") on update cascade on delete set null;

alter table public."merchant_order_issues" drop constraint if exists "merchant_order_issues_reported_by_fkey";
alter table public."merchant_order_issues" add constraint "merchant_order_issues_reported_by_fkey" foreign key ("reported_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."merchant_order_issues" drop constraint if exists "merchant_order_issues_resolved_by_fkey";
alter table public."merchant_order_issues" add constraint "merchant_order_issues_resolved_by_fkey" foreign key ("resolved_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."order_item_verifications" drop constraint if exists "order_item_verifications_order_item_id_fkey";
alter table public."order_item_verifications" add constraint "order_item_verifications_order_item_id_fkey" foreign key ("order_item_id") references public."order_items" ("id") on update cascade on delete restrict;

alter table public."order_item_verifications" drop constraint if exists "order_item_verifications_verified_variant_id_fkey";
alter table public."order_item_verifications" add constraint "order_item_verifications_verified_variant_id_fkey" foreign key ("verified_variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."order_item_verifications" drop constraint if exists "order_item_verifications_verified_by_fkey";
alter table public."order_item_verifications" add constraint "order_item_verifications_verified_by_fkey" foreign key ("verified_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."payments" drop constraint if exists "payments_order_id_fkey";
alter table public."payments" add constraint "payments_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete restrict;

alter table public."payments" drop constraint if exists "payments_customer_id_fkey";
alter table public."payments" add constraint "payments_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."payment_events" drop constraint if exists "payment_events_payment_id_fkey";
alter table public."payment_events" add constraint "payment_events_payment_id_fkey" foreign key ("payment_id") references public."payments" ("id") on update cascade on delete set null;

alter table public."return_requests" drop constraint if exists "return_requests_order_id_fkey";
alter table public."return_requests" add constraint "return_requests_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete restrict;

alter table public."return_requests" drop constraint if exists "return_requests_customer_id_fkey";
alter table public."return_requests" add constraint "return_requests_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."return_requests" drop constraint if exists "return_requests_shop_id_fkey";
alter table public."return_requests" add constraint "return_requests_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."return_items" drop constraint if exists "return_items_return_request_id_fkey";
alter table public."return_items" add constraint "return_items_return_request_id_fkey" foreign key ("return_request_id") references public."return_requests" ("id") on update cascade on delete restrict;

alter table public."return_items" drop constraint if exists "return_items_order_item_id_fkey";
alter table public."return_items" add constraint "return_items_order_item_id_fkey" foreign key ("order_item_id") references public."order_items" ("id") on update cascade on delete restrict;

alter table public."return_items" drop constraint if exists "return_items_inspected_by_fkey";
alter table public."return_items" add constraint "return_items_inspected_by_fkey" foreign key ("inspected_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."return_evidence" drop constraint if exists "return_evidence_return_request_id_fkey";
alter table public."return_evidence" add constraint "return_evidence_return_request_id_fkey" foreign key ("return_request_id") references public."return_requests" ("id") on update cascade on delete restrict;

alter table public."return_evidence" drop constraint if exists "return_evidence_uploaded_by_fkey";
alter table public."return_evidence" add constraint "return_evidence_uploaded_by_fkey" foreign key ("uploaded_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."return_status_history" drop constraint if exists "return_status_history_return_request_id_fkey";
alter table public."return_status_history" add constraint "return_status_history_return_request_id_fkey" foreign key ("return_request_id") references public."return_requests" ("id") on update cascade on delete restrict;

alter table public."return_status_history" drop constraint if exists "return_status_history_changed_by_fkey";
alter table public."return_status_history" add constraint "return_status_history_changed_by_fkey" foreign key ("changed_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."refunds" drop constraint if exists "refunds_order_id_fkey";
alter table public."refunds" add constraint "refunds_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete restrict;

alter table public."refunds" drop constraint if exists "refunds_payment_id_fkey";
alter table public."refunds" add constraint "refunds_payment_id_fkey" foreign key ("payment_id") references public."payments" ("id") on update cascade on delete set null;

alter table public."refunds" drop constraint if exists "refunds_return_request_id_fkey";
alter table public."refunds" add constraint "refunds_return_request_id_fkey" foreign key ("return_request_id") references public."return_requests" ("id") on update cascade on delete set null;

alter table public."refunds" drop constraint if exists "refunds_initiated_by_fkey";
alter table public."refunds" add constraint "refunds_initiated_by_fkey" foreign key ("initiated_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."refunds" drop constraint if exists "refunds_approved_by_fkey";
alter table public."refunds" add constraint "refunds_approved_by_fkey" foreign key ("approved_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."merchant_settlements" drop constraint if exists "merchant_settlements_shop_id_fkey";
alter table public."merchant_settlements" add constraint "merchant_settlements_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete restrict;

alter table public."merchant_settlements" drop constraint if exists "merchant_settlements_bank_account_id_fkey";
alter table public."merchant_settlements" add constraint "merchant_settlements_bank_account_id_fkey" foreign key ("bank_account_id") references public."shop_bank_accounts" ("id") on update cascade on delete restrict;

alter table public."merchant_settlement_items" drop constraint if exists "merchant_settlement_items_settlement_id_fkey";
alter table public."merchant_settlement_items" add constraint "merchant_settlement_items_settlement_id_fkey" foreign key ("settlement_id") references public."merchant_settlements" ("id") on update cascade on delete restrict;

alter table public."merchant_settlement_items" drop constraint if exists "merchant_settlement_items_order_id_fkey";
alter table public."merchant_settlement_items" add constraint "merchant_settlement_items_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete set null;

alter table public."merchant_settlement_items" drop constraint if exists "merchant_settlement_items_refund_id_fkey";
alter table public."merchant_settlement_items" add constraint "merchant_settlement_items_refund_id_fkey" foreign key ("refund_id") references public."refunds" ("id") on update cascade on delete set null;

alter table public."captain_documents" drop constraint if exists "captain_documents_captain_id_fkey";
alter table public."captain_documents" add constraint "captain_documents_captain_id_fkey" foreign key ("captain_id") references public."captain_profiles" ("user_id") on update cascade on delete cascade;

alter table public."captain_documents" drop constraint if exists "captain_documents_verified_by_fkey";
alter table public."captain_documents" add constraint "captain_documents_verified_by_fkey" foreign key ("verified_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."delivery_tasks" drop constraint if exists "delivery_tasks_order_id_fkey";
alter table public."delivery_tasks" add constraint "delivery_tasks_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete set null;

alter table public."delivery_tasks" drop constraint if exists "delivery_tasks_return_request_id_fkey";
alter table public."delivery_tasks" add constraint "delivery_tasks_return_request_id_fkey" foreign key ("return_request_id") references public."return_requests" ("id") on update cascade on delete set null;

alter table public."delivery_tasks" drop constraint if exists "delivery_tasks_pickup_shop_id_fkey";
alter table public."delivery_tasks" add constraint "delivery_tasks_pickup_shop_id_fkey" foreign key ("pickup_shop_id") references public."shops" ("id") on update cascade on delete set null;

alter table public."delivery_tasks" drop constraint if exists "delivery_tasks_assigned_captain_id_fkey";
alter table public."delivery_tasks" add constraint "delivery_tasks_assigned_captain_id_fkey" foreign key ("assigned_captain_id") references public."captain_profiles" ("user_id") on update cascade on delete set null;

alter table public."delivery_assignments" drop constraint if exists "delivery_assignments_delivery_task_id_fkey";
alter table public."delivery_assignments" add constraint "delivery_assignments_delivery_task_id_fkey" foreign key ("delivery_task_id") references public."delivery_tasks" ("id") on update cascade on delete restrict;

alter table public."delivery_assignments" drop constraint if exists "delivery_assignments_captain_id_fkey";
alter table public."delivery_assignments" add constraint "delivery_assignments_captain_id_fkey" foreign key ("captain_id") references public."captain_profiles" ("user_id") on update cascade on delete cascade;

alter table public."delivery_assignments" drop constraint if exists "delivery_assignments_assigned_by_user_id_fkey";
alter table public."delivery_assignments" add constraint "delivery_assignments_assigned_by_user_id_fkey" foreign key ("assigned_by_user_id") references public."profiles" ("id") on update cascade on delete set null;

alter table public."captain_current_locations" drop constraint if exists "captain_current_locations_captain_id_fkey";
alter table public."captain_current_locations" add constraint "captain_current_locations_captain_id_fkey" foreign key ("captain_id") references public."captain_profiles" ("user_id") on update cascade on delete cascade;

alter table public."captain_current_locations" drop constraint if exists "captain_current_locations_active_delivery_task_id_fkey";
alter table public."captain_current_locations" add constraint "captain_current_locations_active_delivery_task_id_fkey" foreign key ("active_delivery_task_id") references public."delivery_tasks" ("id") on update cascade on delete set null;

alter table public."captain_location_history" drop constraint if exists "captain_location_history_captain_id_fkey";
alter table public."captain_location_history" add constraint "captain_location_history_captain_id_fkey" foreign key ("captain_id") references public."captain_profiles" ("user_id") on update cascade on delete cascade;

alter table public."captain_location_history" drop constraint if exists "captain_location_history_delivery_task_id_fkey";
alter table public."captain_location_history" add constraint "captain_location_history_delivery_task_id_fkey" foreign key ("delivery_task_id") references public."delivery_tasks" ("id") on update cascade on delete set null;

alter table public."delivery_events" drop constraint if exists "delivery_events_delivery_task_id_fkey";
alter table public."delivery_events" add constraint "delivery_events_delivery_task_id_fkey" foreign key ("delivery_task_id") references public."delivery_tasks" ("id") on update cascade on delete restrict;

alter table public."delivery_events" drop constraint if exists "delivery_events_actor_user_id_fkey";
alter table public."delivery_events" add constraint "delivery_events_actor_user_id_fkey" foreign key ("actor_user_id") references public."profiles" ("id") on update cascade on delete set null;

alter table public."cod_collections" drop constraint if exists "cod_collections_order_id_fkey";
alter table public."cod_collections" add constraint "cod_collections_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete restrict;

alter table public."cod_collections" drop constraint if exists "cod_collections_delivery_task_id_fkey";
alter table public."cod_collections" add constraint "cod_collections_delivery_task_id_fkey" foreign key ("delivery_task_id") references public."delivery_tasks" ("id") on update cascade on delete restrict;

alter table public."cod_collections" drop constraint if exists "cod_collections_captain_id_fkey";
alter table public."cod_collections" add constraint "cod_collections_captain_id_fkey" foreign key ("captain_id") references public."captain_profiles" ("user_id") on update cascade on delete cascade;

alter table public."cod_collections" drop constraint if exists "cod_collections_reconciled_by_fkey";
alter table public."cod_collections" add constraint "cod_collections_reconciled_by_fkey" foreign key ("reconciled_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."captain_earnings" drop constraint if exists "captain_earnings_captain_id_fkey";
alter table public."captain_earnings" add constraint "captain_earnings_captain_id_fkey" foreign key ("captain_id") references public."captain_profiles" ("user_id") on update cascade on delete cascade;

alter table public."captain_earnings" drop constraint if exists "captain_earnings_delivery_task_id_fkey";
alter table public."captain_earnings" add constraint "captain_earnings_delivery_task_id_fkey" foreign key ("delivery_task_id") references public."delivery_tasks" ("id") on update cascade on delete restrict;

alter table public."captain_payouts" drop constraint if exists "captain_payouts_captain_id_fkey";
alter table public."captain_payouts" add constraint "captain_payouts_captain_id_fkey" foreign key ("captain_id") references public."captain_profiles" ("user_id") on update cascade on delete cascade;

alter table public."captain_payout_items" drop constraint if exists "captain_payout_items_payout_id_fkey";
alter table public."captain_payout_items" add constraint "captain_payout_items_payout_id_fkey" foreign key ("payout_id") references public."captain_payouts" ("id") on update cascade on delete restrict;

alter table public."captain_payout_items" drop constraint if exists "captain_payout_items_captain_earning_id_fkey";
alter table public."captain_payout_items" add constraint "captain_payout_items_captain_earning_id_fkey" foreign key ("captain_earning_id") references public."captain_earnings" ("id") on update cascade on delete set null;

alter table public."style_groups" drop constraint if exists "style_groups_creator_customer_id_fkey";
alter table public."style_groups" add constraint "style_groups_creator_customer_id_fkey" foreign key ("creator_customer_id") references public."customer_profiles" ("user_id") on update cascade on delete restrict;

alter table public."style_group_members" drop constraint if exists "style_group_members_group_id_fkey";
alter table public."style_group_members" add constraint "style_group_members_group_id_fkey" foreign key ("group_id") references public."style_groups" ("id") on update cascade on delete restrict;

alter table public."style_group_members" drop constraint if exists "style_group_members_customer_id_fkey";
alter table public."style_group_members" add constraint "style_group_members_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete set null;

alter table public."style_group_member_preferences" drop constraint if exists "style_group_member_preferences_group_member_id_fkey";
alter table public."style_group_member_preferences" add constraint "style_group_member_preferences_group_member_id_fkey" foreign key ("group_member_id") references public."style_group_members" ("id") on update cascade on delete restrict;

alter table public."style_group_member_preferences" drop constraint if exists "style_group_member_preferences_private_body_profile_id_fkey";
alter table public."style_group_member_preferences" add constraint "style_group_member_preferences_private_body_profile_id_fkey" foreign key ("private_body_profile_id") references public."customer_body_profiles" ("id") on update cascade on delete set null;

alter table public."style_themes" drop constraint if exists "style_themes_group_id_fkey";
alter table public."style_themes" add constraint "style_themes_group_id_fkey" foreign key ("group_id") references public."style_groups" ("id") on update cascade on delete restrict;

alter table public."style_themes" drop constraint if exists "style_themes_created_by_fkey";
alter table public."style_themes" add constraint "style_themes_created_by_fkey" foreign key ("created_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."style_polls" drop constraint if exists "style_polls_group_id_fkey";
alter table public."style_polls" add constraint "style_polls_group_id_fkey" foreign key ("group_id") references public."style_groups" ("id") on update cascade on delete restrict;

alter table public."style_polls" drop constraint if exists "style_polls_created_by_fkey";
alter table public."style_polls" add constraint "style_polls_created_by_fkey" foreign key ("created_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."style_poll_options" drop constraint if exists "style_poll_options_poll_id_fkey";
alter table public."style_poll_options" add constraint "style_poll_options_poll_id_fkey" foreign key ("poll_id") references public."style_polls" ("id") on update cascade on delete cascade;

alter table public."style_poll_options" drop constraint if exists "style_poll_options_product_id_fkey";
alter table public."style_poll_options" add constraint "style_poll_options_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete set null;

alter table public."style_poll_options" drop constraint if exists "style_poll_options_theme_id_fkey";
alter table public."style_poll_options" add constraint "style_poll_options_theme_id_fkey" foreign key ("theme_id") references public."style_themes" ("id") on update cascade on delete set null;

alter table public."style_poll_votes" drop constraint if exists "style_poll_votes_poll_id_fkey";
alter table public."style_poll_votes" add constraint "style_poll_votes_poll_id_fkey" foreign key ("poll_id") references public."style_polls" ("id") on update cascade on delete cascade;

alter table public."style_poll_votes" drop constraint if exists "style_poll_votes_option_id_fkey";
alter table public."style_poll_votes" add constraint "style_poll_votes_option_id_fkey" foreign key ("option_id") references public."style_poll_options" ("id") on update cascade on delete cascade;

alter table public."style_poll_votes" drop constraint if exists "style_poll_votes_group_member_id_fkey";
alter table public."style_poll_votes" add constraint "style_poll_votes_group_member_id_fkey" foreign key ("group_member_id") references public."style_group_members" ("id") on update cascade on delete cascade;

alter table public."style_moodboards" drop constraint if exists "style_moodboards_group_id_fkey";
alter table public."style_moodboards" add constraint "style_moodboards_group_id_fkey" foreign key ("group_id") references public."style_groups" ("id") on update cascade on delete restrict;

alter table public."style_moodboards" drop constraint if exists "style_moodboards_theme_id_fkey";
alter table public."style_moodboards" add constraint "style_moodboards_theme_id_fkey" foreign key ("theme_id") references public."style_themes" ("id") on update cascade on delete set null;

alter table public."style_moodboards" drop constraint if exists "style_moodboards_created_by_fkey";
alter table public."style_moodboards" add constraint "style_moodboards_created_by_fkey" foreign key ("created_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."style_moodboard_items" drop constraint if exists "style_moodboard_items_moodboard_id_fkey";
alter table public."style_moodboard_items" add constraint "style_moodboard_items_moodboard_id_fkey" foreign key ("moodboard_id") references public."style_moodboards" ("id") on update cascade on delete restrict;

alter table public."style_moodboard_items" drop constraint if exists "style_moodboard_items_group_member_id_fkey";
alter table public."style_moodboard_items" add constraint "style_moodboard_items_group_member_id_fkey" foreign key ("group_member_id") references public."style_group_members" ("id") on update cascade on delete set null;

alter table public."style_moodboard_items" drop constraint if exists "style_moodboard_items_product_id_fkey";
alter table public."style_moodboard_items" add constraint "style_moodboard_items_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete set null;

alter table public."style_moodboard_items" drop constraint if exists "style_moodboard_items_variant_id_fkey";
alter table public."style_moodboard_items" add constraint "style_moodboard_items_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."notifications" drop constraint if exists "notifications_user_id_fkey";
alter table public."notifications" add constraint "notifications_user_id_fkey" foreign key ("user_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."notification_deliveries" drop constraint if exists "notification_deliveries_notification_id_fkey";
alter table public."notification_deliveries" add constraint "notification_deliveries_notification_id_fkey" foreign key ("notification_id") references public."notifications" ("id") on update cascade on delete restrict;

alter table public."notification_deliveries" drop constraint if exists "notification_deliveries_device_id_fkey";
alter table public."notification_deliveries" add constraint "notification_deliveries_device_id_fkey" foreign key ("device_id") references public."user_devices" ("id") on update cascade on delete set null;

alter table public."notification_preferences" drop constraint if exists "notification_preferences_user_id_fkey";
alter table public."notification_preferences" add constraint "notification_preferences_user_id_fkey" foreign key ("user_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."reviews" drop constraint if exists "reviews_order_id_fkey";
alter table public."reviews" add constraint "reviews_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete restrict;

alter table public."reviews" drop constraint if exists "reviews_customer_id_fkey";
alter table public."reviews" add constraint "reviews_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."reviews" drop constraint if exists "reviews_shop_id_fkey";
alter table public."reviews" add constraint "reviews_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete set null;

alter table public."reviews" drop constraint if exists "reviews_product_id_fkey";
alter table public."reviews" add constraint "reviews_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete set null;

alter table public."reviews" drop constraint if exists "reviews_captain_id_fkey";
alter table public."reviews" add constraint "reviews_captain_id_fkey" foreign key ("captain_id") references public."captain_profiles" ("user_id") on update cascade on delete set null;

alter table public."customer_events" drop constraint if exists "customer_events_customer_id_fkey";
alter table public."customer_events" add constraint "customer_events_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete set null;

alter table public."customer_events" drop constraint if exists "customer_events_shop_id_fkey";
alter table public."customer_events" add constraint "customer_events_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete set null;

alter table public."recommendation_sets" drop constraint if exists "recommendation_sets_customer_id_fkey";
alter table public."recommendation_sets" add constraint "recommendation_sets_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete set null;

alter table public."recommendation_items" drop constraint if exists "recommendation_items_recommendation_set_id_fkey";
alter table public."recommendation_items" add constraint "recommendation_items_recommendation_set_id_fkey" foreign key ("recommendation_set_id") references public."recommendation_sets" ("id") on update cascade on delete restrict;

alter table public."recommendation_items" drop constraint if exists "recommendation_items_product_id_fkey";
alter table public."recommendation_items" add constraint "recommendation_items_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."recommendation_items" drop constraint if exists "recommendation_items_variant_id_fkey";
alter table public."recommendation_items" add constraint "recommendation_items_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."product_embeddings" drop constraint if exists "product_embeddings_product_id_fkey";
alter table public."product_embeddings" add constraint "product_embeddings_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."customer_embeddings" drop constraint if exists "customer_embeddings_customer_id_fkey";
alter table public."customer_embeddings" add constraint "customer_embeddings_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."size_charts" drop constraint if exists "size_charts_shop_id_fkey";
alter table public."size_charts" add constraint "size_charts_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete set null;

alter table public."size_charts" drop constraint if exists "size_charts_category_id_fkey";
alter table public."size_charts" add constraint "size_charts_category_id_fkey" foreign key ("category_id") references public."categories" ("id") on update cascade on delete restrict;

alter table public."size_chart_measurements" drop constraint if exists "size_chart_measurements_size_chart_id_fkey";
alter table public."size_chart_measurements" add constraint "size_chart_measurements_size_chart_id_fkey" foreign key ("size_chart_id") references public."size_charts" ("id") on update cascade on delete restrict;

alter table public."customer_body_profiles" drop constraint if exists "customer_body_profiles_customer_id_fkey";
alter table public."customer_body_profiles" add constraint "customer_body_profiles_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."body_measurements" drop constraint if exists "body_measurements_body_profile_id_fkey";
alter table public."body_measurements" add constraint "body_measurements_body_profile_id_fkey" foreign key ("body_profile_id") references public."customer_body_profiles" ("id") on update cascade on delete restrict;

alter table public."body_scan_sessions" drop constraint if exists "body_scan_sessions_customer_id_fkey";
alter table public."body_scan_sessions" add constraint "body_scan_sessions_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."body_scan_sessions" drop constraint if exists "body_scan_sessions_body_profile_id_fkey";
alter table public."body_scan_sessions" add constraint "body_scan_sessions_body_profile_id_fkey" foreign key ("body_profile_id") references public."customer_body_profiles" ("id") on update cascade on delete set null;

alter table public."fit_recommendations" drop constraint if exists "fit_recommendations_customer_id_fkey";
alter table public."fit_recommendations" add constraint "fit_recommendations_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."fit_recommendations" drop constraint if exists "fit_recommendations_body_profile_id_fkey";
alter table public."fit_recommendations" add constraint "fit_recommendations_body_profile_id_fkey" foreign key ("body_profile_id") references public."customer_body_profiles" ("id") on update cascade on delete set null;

alter table public."fit_recommendations" drop constraint if exists "fit_recommendations_product_id_fkey";
alter table public."fit_recommendations" add constraint "fit_recommendations_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."fit_recommendations" drop constraint if exists "fit_recommendations_variant_id_fkey";
alter table public."fit_recommendations" add constraint "fit_recommendations_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."fit_feedback" drop constraint if exists "fit_feedback_customer_id_fkey";
alter table public."fit_feedback" add constraint "fit_feedback_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."fit_feedback" drop constraint if exists "fit_feedback_order_item_id_fkey";
alter table public."fit_feedback" add constraint "fit_feedback_order_item_id_fkey" foreign key ("order_item_id") references public."order_items" ("id") on update cascade on delete restrict;

alter table public."fit_feedback" drop constraint if exists "fit_feedback_fit_recommendation_id_fkey";
alter table public."fit_feedback" add constraint "fit_feedback_fit_recommendation_id_fkey" foreign key ("fit_recommendation_id") references public."fit_recommendations" ("id") on update cascade on delete set null;

alter table public."virtual_tryon_sessions" drop constraint if exists "virtual_tryon_sessions_customer_id_fkey";
alter table public."virtual_tryon_sessions" add constraint "virtual_tryon_sessions_customer_id_fkey" foreign key ("customer_id") references public."customer_profiles" ("user_id") on update cascade on delete cascade;

alter table public."virtual_tryon_sessions" drop constraint if exists "virtual_tryon_sessions_product_id_fkey";
alter table public."virtual_tryon_sessions" add constraint "virtual_tryon_sessions_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."virtual_tryon_sessions" drop constraint if exists "virtual_tryon_sessions_variant_id_fkey";
alter table public."virtual_tryon_sessions" add constraint "virtual_tryon_sessions_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."virtual_tryon_sessions" drop constraint if exists "virtual_tryon_sessions_body_profile_id_fkey";
alter table public."virtual_tryon_sessions" add constraint "virtual_tryon_sessions_body_profile_id_fkey" foreign key ("body_profile_id") references public."customer_body_profiles" ("id") on update cascade on delete set null;

alter table public."virtual_tryon_outputs" drop constraint if exists "virtual_tryon_outputs_tryon_session_id_fkey";
alter table public."virtual_tryon_outputs" add constraint "virtual_tryon_outputs_tryon_session_id_fkey" foreign key ("tryon_session_id") references public."virtual_tryon_sessions" ("id") on update cascade on delete restrict;

alter table public."style_recommendation_sets" drop constraint if exists "style_recommendation_sets_group_id_fkey";
alter table public."style_recommendation_sets" add constraint "style_recommendation_sets_group_id_fkey" foreign key ("group_id") references public."style_groups" ("id") on update cascade on delete restrict;

alter table public."style_recommendation_sets" drop constraint if exists "style_recommendation_sets_theme_id_fkey";
alter table public."style_recommendation_sets" add constraint "style_recommendation_sets_theme_id_fkey" foreign key ("theme_id") references public."style_themes" ("id") on update cascade on delete set null;

alter table public."style_recommendation_items" drop constraint if exists "style_recommendation_items_recommendation_set_id_fkey";
alter table public."style_recommendation_items" add constraint "style_recommendation_items_recommendation_set_id_fkey" foreign key ("recommendation_set_id") references public."style_recommendation_sets" ("id") on update cascade on delete restrict;

alter table public."style_recommendation_items" drop constraint if exists "style_recommendation_items_group_member_id_fkey";
alter table public."style_recommendation_items" add constraint "style_recommendation_items_group_member_id_fkey" foreign key ("group_member_id") references public."style_group_members" ("id") on update cascade on delete restrict;

alter table public."style_recommendation_items" drop constraint if exists "style_recommendation_items_product_id_fkey";
alter table public."style_recommendation_items" add constraint "style_recommendation_items_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."style_recommendation_items" drop constraint if exists "style_recommendation_items_variant_id_fkey";
alter table public."style_recommendation_items" add constraint "style_recommendation_items_variant_id_fkey" foreign key ("variant_id") references public."product_variants" ("id") on update cascade on delete set null;

alter table public."support_tickets" drop constraint if exists "support_tickets_raised_by_user_id_fkey";
alter table public."support_tickets" add constraint "support_tickets_raised_by_user_id_fkey" foreign key ("raised_by_user_id") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."support_tickets" drop constraint if exists "support_tickets_order_id_fkey";
alter table public."support_tickets" add constraint "support_tickets_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete set null;

alter table public."support_tickets" drop constraint if exists "support_tickets_shop_id_fkey";
alter table public."support_tickets" add constraint "support_tickets_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete set null;

alter table public."support_tickets" drop constraint if exists "support_tickets_delivery_task_id_fkey";
alter table public."support_tickets" add constraint "support_tickets_delivery_task_id_fkey" foreign key ("delivery_task_id") references public."delivery_tasks" ("id") on update cascade on delete set null;

alter table public."support_tickets" drop constraint if exists "support_tickets_return_request_id_fkey";
alter table public."support_tickets" add constraint "support_tickets_return_request_id_fkey" foreign key ("return_request_id") references public."return_requests" ("id") on update cascade on delete set null;

alter table public."support_tickets" drop constraint if exists "support_tickets_assigned_to_fkey";
alter table public."support_tickets" add constraint "support_tickets_assigned_to_fkey" foreign key ("assigned_to") references public."profiles" ("id") on update cascade on delete set null;

alter table public."support_messages" drop constraint if exists "support_messages_ticket_id_fkey";
alter table public."support_messages" add constraint "support_messages_ticket_id_fkey" foreign key ("ticket_id") references public."support_tickets" ("id") on update cascade on delete cascade;

alter table public."support_messages" drop constraint if exists "support_messages_sender_id_fkey";
alter table public."support_messages" add constraint "support_messages_sender_id_fkey" foreign key ("sender_id") references public."profiles" ("id") on update cascade on delete cascade;

alter table public."campaigns" drop constraint if exists "campaigns_created_by_fkey";
alter table public."campaigns" add constraint "campaigns_created_by_fkey" foreign key ("created_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."campaigns" drop constraint if exists "campaigns_approved_by_fkey";
alter table public."campaigns" add constraint "campaigns_approved_by_fkey" foreign key ("approved_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."banners" drop constraint if exists "banners_campaign_id_fkey";
alter table public."banners" add constraint "banners_campaign_id_fkey" foreign key ("campaign_id") references public."campaigns" ("id") on update cascade on delete restrict;

alter table public."merchant_leads" drop constraint if exists "merchant_leads_assigned_executive_id_fkey";
alter table public."merchant_leads" add constraint "merchant_leads_assigned_executive_id_fkey" foreign key ("assigned_executive_id") references public."profiles" ("id") on update cascade on delete set null;

alter table public."field_visits" drop constraint if exists "field_visits_merchant_lead_id_fkey";
alter table public."field_visits" add constraint "field_visits_merchant_lead_id_fkey" foreign key ("merchant_lead_id") references public."merchant_leads" ("id") on update cascade on delete set null;

alter table public."field_visits" drop constraint if exists "field_visits_shop_id_fkey";
alter table public."field_visits" add constraint "field_visits_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete set null;

alter table public."field_visits" drop constraint if exists "field_visits_executive_id_fkey";
alter table public."field_visits" add constraint "field_visits_executive_id_fkey" foreign key ("executive_id") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."field_visit_checklist_items" drop constraint if exists "field_visit_checklist_items_field_visit_id_fkey";
alter table public."field_visit_checklist_items" add constraint "field_visit_checklist_items_field_visit_id_fkey" foreign key ("field_visit_id") references public."field_visits" ("id") on update cascade on delete restrict;

alter table public."field_visit_checklist_items" drop constraint if exists "field_visit_checklist_items_completed_by_fkey";
alter table public."field_visit_checklist_items" add constraint "field_visit_checklist_items_completed_by_fkey" foreign key ("completed_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."product_moderation_cases" drop constraint if exists "product_moderation_cases_product_id_fkey";
alter table public."product_moderation_cases" add constraint "product_moderation_cases_product_id_fkey" foreign key ("product_id") references public."products" ("id") on update cascade on delete restrict;

alter table public."product_moderation_cases" drop constraint if exists "product_moderation_cases_moderator_id_fkey";
alter table public."product_moderation_cases" add constraint "product_moderation_cases_moderator_id_fkey" foreign key ("moderator_id") references public."profiles" ("id") on update cascade on delete set null;

alter table public."approval_requests" drop constraint if exists "approval_requests_requested_by_fkey";
alter table public."approval_requests" add constraint "approval_requests_requested_by_fkey" foreign key ("requested_by") references public."profiles" ("id") on update cascade on delete restrict;

alter table public."approval_requests" drop constraint if exists "approval_requests_approved_by_fkey";
alter table public."approval_requests" add constraint "approval_requests_approved_by_fkey" foreign key ("approved_by") references public."profiles" ("id") on update cascade on delete set null;

alter table public."fraud_cases" drop constraint if exists "fraud_cases_subject_user_id_fkey";
alter table public."fraud_cases" add constraint "fraud_cases_subject_user_id_fkey" foreign key ("subject_user_id") references public."profiles" ("id") on update cascade on delete set null;

alter table public."fraud_cases" drop constraint if exists "fraud_cases_shop_id_fkey";
alter table public."fraud_cases" add constraint "fraud_cases_shop_id_fkey" foreign key ("shop_id") references public."shops" ("id") on update cascade on delete set null;

alter table public."fraud_cases" drop constraint if exists "fraud_cases_order_id_fkey";
alter table public."fraud_cases" add constraint "fraud_cases_order_id_fkey" foreign key ("order_id") references public."orders" ("id") on update cascade on delete set null;

alter table public."fraud_cases" drop constraint if exists "fraud_cases_assigned_to_fkey";
alter table public."fraud_cases" add constraint "fraud_cases_assigned_to_fkey" foreign key ("assigned_to") references public."profiles" ("id") on update cascade on delete set null;

alter table public."audit_logs" drop constraint if exists "audit_logs_actor_user_id_fkey";
alter table public."audit_logs" add constraint "audit_logs_actor_user_id_fkey" foreign key ("actor_user_id") references public."profiles" ("id") on update cascade on delete set null;

alter table public."audit_logs" drop constraint if exists "audit_logs_device_id_fkey";
alter table public."audit_logs" add constraint "audit_logs_device_id_fkey" foreign key ("device_id") references public."user_devices" ("id") on update cascade on delete set null;

alter table public."system_settings" drop constraint if exists "system_settings_updated_by_fkey";
alter table public."system_settings" add constraint "system_settings_updated_by_fkey" foreign key ("updated_by") references public."profiles" ("id") on update cascade on delete restrict;
