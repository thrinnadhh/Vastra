-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


-- Marketplace: shops
create table if not exists public."shops" (
  "id" uuid default gen_random_uuid() not null primary key,
  "merchant_id" uuid not null,
  "shop_code" text not null,
  "name" text not null,
  "slug" text not null,
  "description" text,
  "phone_number" text not null,
  "email" citext,
  "address_line1" text not null,
  "address_line2" text,
  "landmark" text,
  "area" text not null,
  "city" text not null,
  "state" text not null,
  "postal_code" text not null,
  "country_code" text default 'IN' not null,
  "location" geography(Point,4326) not null,
  "logo_path" text,
  "cover_image_path" text,
  "verification_status" text default 'PENDING' not null,
  "operational_status" text default 'CLOSED_FOR_DAY' not null,
  "accepts_online_orders" boolean default false not null,
  "service_radius_meters" integer default 5000 not null,
  "minimum_order_paise" bigint default 0 not null,
  "average_preparation_minutes" integer default 15 not null,
  "rating_average" numeric(3,2) default 0 not null,
  "rating_count" integer default 0 not null,
  "follower_count" integer default 0 not null,
  "version" integer default 1 not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "deleted_at" timestamptz,
  constraint "shops_shop_code_key" unique ("shop_code"),
  constraint "shops_slug_key" unique ("slug"),
  constraint "shops_verification_status_check" check ("verification_status" in ('PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED')),
  constraint "shops_operational_status_check" check ("operational_status" in ('OPEN', 'BUSY', 'TEMPORARILY_CLOSED', 'CLOSED_FOR_DAY', 'PAUSED', 'SUSPENDED')),
  constraint "shops_service_radius_meters_nonnegative" check ("service_radius_meters" is null or "service_radius_meters" >= 0),
  constraint "shops_minimum_order_paise_nonnegative" check ("minimum_order_paise" is null or "minimum_order_paise" >= 0),
  constraint "shops_average_preparation_minutes_nonnegative" check ("average_preparation_minutes" is null or "average_preparation_minutes" >= 0),
  constraint "shops_rating_average_check" check (rating_average between 0 and 5),
  constraint "shops_rating_count_nonnegative" check ("rating_count" is null or "rating_count" >= 0),
  constraint "shops_follower_count_nonnegative" check ("follower_count" is null or "follower_count" >= 0),
  constraint "shops_version_nonnegative" check ("version" is null or "version" >= 0)
);

comment on table public."shops" is 'Canonical shop record shown in the customer marketplace and controlled by the approved merchant.';

-- Marketplace: shop_hours
create table if not exists public."shop_hours" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid not null,
  "schedule_type" text default 'WEEKLY' not null,
  "day_of_week" smallint,
  "special_date" date,
  "open_time" time,
  "close_time" time,
  "is_closed" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "shop_hours_rule_1" unique (shop_id, schedule_type, day_of_week, special_date),
  constraint "shop_hours_schedule_type_check" check ("schedule_type" in ('WEEKLY', 'SPECIAL_DATE')),
  constraint "shop_hours_day_of_week_check" check (day_of_week between 0 and 6)
);

comment on table public."shop_hours" is 'Weekly and date-specific opening hours.';

-- Marketplace: shop_documents
create table if not exists public."shop_documents" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid not null,
  "uploaded_by" uuid not null,
  "document_type" text not null,
  "document_number_last4" text,
  "document_number_encrypted" text,
  "storage_path" text not null,
  "verification_status" text default 'PENDING' not null,
  "verified_by" uuid,
  "verified_at" timestamptz,
  "rejection_reason" text,
  "created_at" timestamptz default now() not null,
  constraint "shop_documents_document_type_check" check ("document_type" in ('PAN', 'GST', 'LICENSE', 'ADDRESS_PROOF', 'OWNER_ID', 'SHOP_PHOTO', 'OTHER')),
  constraint "shop_documents_verification_status_check" check ("verification_status" in ('PENDING', 'VERIFIED', 'REJECTED'))
);

comment on table public."shop_documents" is 'Private merchant/shop KYC files and verification status.';

-- Marketplace: shop_bank_accounts
create table if not exists public."shop_bank_accounts" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid not null,
  "account_holder_name" text not null,
  "account_number_last4" text not null,
  "account_number_encrypted" text not null,
  "ifsc_code" text not null,
  "bank_name" text,
  "branch_name" text,
  "is_primary" boolean default true not null,
  "verification_status" text default 'PENDING' not null,
  "verified_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "shop_bank_accounts_verification_status_check" check ("verification_status" in ('PENDING', 'VERIFIED', 'REJECTED'))
);

comment on table public."shop_bank_accounts" is 'Private merchant payout account records.';

-- Catalogue: categories
create table if not exists public."categories" (
  "id" uuid default gen_random_uuid() not null primary key,
  "parent_id" uuid,
  "name" text not null,
  "slug" text not null,
  "description" text,
  "icon_path" text,
  "display_order" integer default 0 not null,
  "is_active" boolean default true not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "categories_slug_key" unique ("slug")
);

comment on table public."categories" is 'Hierarchical catalogue taxonomy covering clothing, footwear and accessories.';

-- Catalogue: products
create table if not exists public."products" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid not null,
  "category_id" uuid not null,
  "name" text not null,
  "slug" text not null,
  "description" text,
  "brand" text,
  "material" text,
  "gender_category" text default 'UNISEX' not null,
  "style_tags" text[] default '{}'::text[] not null,
  "occasion_tags" text[] default '{}'::text[] not null,
  "care_instructions" text,
  "return_eligible" boolean default true not null,
  "return_window_days" smallint default 7 not null,
  "moderation_status" text default 'PENDING' not null,
  "is_active" boolean default true not null,
  "search_vector" tsvector,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "deleted_at" timestamptz,
  constraint "products_rule_1" unique (shop_id, slug),
  constraint "products_gender_category_check" check ("gender_category" in ('MEN', 'WOMEN', 'KIDS', 'UNISEX')),
  constraint "products_return_window_days_check" check (return_window_days between 0 and 90),
  constraint "products_moderation_status_check" check ("moderation_status" in ('PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'))
);

comment on table public."products" is 'General merchant product record independent of colour/size variants.';

-- Catalogue: product_images
create table if not exists public."product_images" (
  "id" uuid default gen_random_uuid() not null primary key,
  "product_id" uuid not null,
  "variant_id" uuid,
  "storage_path" text not null,
  "thumbnail_path" text,
  "image_type" text default 'FRONT' not null,
  "alt_text" text,
  "display_order" smallint default 0 not null,
  "is_primary" boolean default false not null,
  "width_px" integer,
  "height_px" integer,
  "created_at" timestamptz default now() not null,
  constraint "product_images_image_type_check" check ("image_type" in ('FRONT', 'BACK', 'SIDE', 'DETAIL', 'MODEL', 'SIZE_CHART'))
);

comment on table public."product_images" is 'Ordered product and variant media references stored in Supabase Storage.';

-- Catalogue: product_variants
create table if not exists public."product_variants" (
  "id" uuid default gen_random_uuid() not null primary key,
  "product_id" uuid not null,
  "shop_id" uuid not null,
  "sku" text not null,
  "colour_name" text,
  "colour_hex" text,
  "size_label" text,
  "mrp_paise" bigint not null,
  "selling_price_paise" bigint not null,
  "cost_price_paise" bigint,
  "weight_grams" integer,
  "length_cm" numeric(8,2),
  "width_cm" numeric(8,2),
  "height_cm" numeric(8,2),
  "attributes" jsonb default '{}'::jsonb not null,
  "is_active" boolean default true not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "product_variants_rule_1" unique (shop_id, sku),
  constraint "product_variants_rule_2" check (selling_price_paise <= mrp_paise),
  constraint "product_variants_mrp_paise_nonnegative" check ("mrp_paise" is null or "mrp_paise" >= 0),
  constraint "product_variants_selling_price_paise_nonnegative" check ("selling_price_paise" is null or "selling_price_paise" >= 0),
  constraint "product_variants_cost_price_paise_nonnegative" check ("cost_price_paise" is null or "cost_price_paise" >= 0),
  constraint "product_variants_weight_grams_nonnegative" check ("weight_grams" is null or "weight_grams" >= 0),
  constraint "product_variants_length_cm_nonnegative" check ("length_cm" is null or "length_cm" >= 0),
  constraint "product_variants_width_cm_nonnegative" check ("width_cm" is null or "width_cm" >= 0),
  constraint "product_variants_height_cm_nonnegative" check ("height_cm" is null or "height_cm" >= 0)
);

comment on table public."product_variants" is 'Exact sellable SKU for each colour, size and optional attribute combination.';

-- Catalogue: variant_barcodes
create table if not exists public."variant_barcodes" (
  "id" uuid default gen_random_uuid() not null primary key,
  "variant_id" uuid not null,
  "barcode_value" text not null,
  "barcode_type" text default 'CODE128' not null,
  "source" text default 'MERCHANT_ENTERED' not null,
  "is_primary" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamptz default now() not null,
  constraint "variant_barcodes_barcode_value_key" unique ("barcode_value"),
  constraint "variant_barcodes_barcode_type_check" check ("barcode_type" in ('EAN13', 'UPC', 'CODE128', 'QR', 'INTERNAL')),
  constraint "variant_barcodes_source_check" check ("source" in ('MANUFACTURER', 'VASTRA_GENERATED', 'MERCHANT_ENTERED'))
);

comment on table public."variant_barcodes" is 'Manufacturer, merchant-entered and Vastra-generated barcodes mapped to exact variants.';

-- Inventory: inventory_balances
create table if not exists public."inventory_balances" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid not null,
  "variant_id" uuid not null,
  "stock_on_hand" integer default 0 not null,
  "reserved_quantity" integer default 0 not null,
  "damaged_quantity" integer default 0 not null,
  "reorder_level" integer default 0 not null,
  "version" integer default 1 not null,
  "last_counted_at" timestamptz,
  "updated_at" timestamptz default now() not null,
  constraint "inventory_balances_rule_1" unique (shop_id, variant_id),
  constraint "inventory_balances_rule_2" check (stock_on_hand >= reserved_quantity + damaged_quantity),
  constraint "inventory_balances_stock_on_hand_nonnegative" check ("stock_on_hand" is null or "stock_on_hand" >= 0),
  constraint "inventory_balances_reserved_quantity_nonnegative" check ("reserved_quantity" is null or "reserved_quantity" >= 0),
  constraint "inventory_balances_damaged_quantity_nonnegative" check ("damaged_quantity" is null or "damaged_quantity" >= 0),
  constraint "inventory_balances_reorder_level_nonnegative" check ("reorder_level" is null or "reorder_level" >= 0),
  constraint "inventory_balances_version_nonnegative" check ("version" is null or "version" >= 0)
);

comment on table public."inventory_balances" is 'Current variant-level physical, reserved and damaged quantities. This is the authoritative balance row.';

-- Inventory: inventory_movements
create table if not exists public."inventory_movements" (
  "id" bigint default generated always as identity not null primary key,
  "shop_id" uuid not null,
  "variant_id" uuid not null,
  "movement_type" text not null,
  "quantity_change" integer not null,
  "reserved_change" integer default 0 not null,
  "damaged_change" integer default 0 not null,
  "stock_before" integer not null,
  "stock_after" integer not null,
  "reserved_before" integer not null,
  "reserved_after" integer not null,
  "damaged_before" integer not null,
  "damaged_after" integer not null,
  "reference_type" text,
  "reference_id" uuid,
  "reason" text,
  "performed_by" uuid,
  "source_method" text default 'SYSTEM' not null,
  "created_at" timestamptz default now() not null,
  constraint "inventory_movements_movement_type_check" check ("movement_type" in ('STOCK_RECEIVED', 'OFFLINE_SALE', 'ONLINE_ORDER_RESERVED', 'ONLINE_ORDER_RELEASED', 'ONLINE_ORDER_COMPLETED', 'RETURN_TO_STOCK', 'MARKED_DAMAGED', 'STOCK_CORRECTION', 'STOCK_AUDIT')),
  constraint "inventory_movements_source_method_check" check ("source_method" in ('BARCODE', 'PHOTO_MATCH', 'MANUAL_SEARCH', 'SYSTEM', 'ADMIN'))
);

comment on table public."inventory_movements" is 'Immutable audit ledger for every stock change from barcode, photo, manual action, order or admin correction.';

-- Inventory: inventory_reservations
create table if not exists public."inventory_reservations" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid not null,
  "variant_id" uuid not null,
  "cart_id" uuid,
  "order_id" uuid,
  "quantity" integer not null,
  "status" text default 'ACTIVE' not null,
  "expires_at" timestamptz not null,
  "created_at" timestamptz default now() not null,
  "released_at" timestamptz,
  constraint "inventory_reservations_quantity_nonnegative" check ("quantity" is null or "quantity" >= 0),
  constraint "inventory_reservations_status_check" check ("status" in ('ACTIVE', 'CONVERTED', 'RELEASED', 'EXPIRED'))
);

comment on table public."inventory_reservations" is 'Temporary or order-linked reservations that prevent double-selling the final unit.';

-- Inventory: product_photo_matches
create table if not exists public."product_photo_matches" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid not null,
  "uploaded_by" uuid not null,
  "uploaded_image_path" text not null,
  "matched_variant_id" uuid,
  "confidence_score" numeric(6,5),
  "candidate_matches" jsonb default '[]'::jsonb not null,
  "merchant_confirmed" boolean default false not null,
  "match_model_version" text,
  "created_at" timestamptz default now() not null,
  constraint "product_photo_matches_confidence_score_check" check (confidence_score between 0 and 1)
);

comment on table public."product_photo_matches" is 'History and feedback for merchant photo-based catalogue matching.';

-- Catalogue: shop_collections
create table if not exists public."shop_collections" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid not null,
  "name" text not null,
  "description" text,
  "collection_type" text default 'MANUAL' not null,
  "cover_image_path" text,
  "is_active" boolean default true not null,
  "display_order" integer default 0 not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "shop_collections_collection_type_check" check ("collection_type" in ('MANUAL', 'COMPLETE_LOOK', 'OCCASION', 'GROUP_STYLE'))
);

comment on table public."shop_collections" is 'Merchant-curated occasion, complete-look and promotional collections.';

-- Catalogue: shop_collection_items
create table if not exists public."shop_collection_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "collection_id" uuid not null,
  "product_id" uuid not null,
  "variant_id" uuid,
  "item_role" text,
  "display_order" integer default 0 not null,
  "created_at" timestamptz default now() not null,
  constraint "shop_collection_items_rule_1" unique (collection_id, product_id, variant_id)
);

comment on table public."shop_collection_items" is 'Ordered products/variants inside merchant collections.';

-- Promotions: offers
create table if not exists public."offers" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid not null,
  "name" text not null,
  "description" text,
  "offer_type" text not null,
  "discount_value" numeric(12,2),
  "minimum_order_paise" bigint default 0 not null,
  "maximum_discount_paise" bigint,
  "usage_limit_total" integer,
  "usage_limit_per_customer" integer default 1 not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "status" text default 'DRAFT' not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "offers_offer_type_check" check ("offer_type" in ('PERCENT', 'FIXED', 'FREE_DELIVERY', 'BUY_X_GET_Y', 'BUNDLE')),
  constraint "offers_discount_value_nonnegative" check ("discount_value" is null or "discount_value" >= 0),
  constraint "offers_minimum_order_paise_nonnegative" check ("minimum_order_paise" is null or "minimum_order_paise" >= 0),
  constraint "offers_maximum_discount_paise_nonnegative" check ("maximum_discount_paise" is null or "maximum_discount_paise" >= 0),
  constraint "offers_usage_limit_total_nonnegative" check ("usage_limit_total" is null or "usage_limit_total" >= 0),
  constraint "offers_usage_limit_per_customer_nonnegative" check ("usage_limit_per_customer" is null or "usage_limit_per_customer" >= 0),
  constraint "offers_status_check" check ("status" in ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED'))
);

comment on table public."offers" is 'Merchant-created discounts and bundle/free-delivery offers.';

-- Promotions: offer_products
create table if not exists public."offer_products" (
  "id" uuid default gen_random_uuid() not null primary key,
  "offer_id" uuid not null,
  "product_id" uuid not null,
  "variant_id" uuid,
  "created_at" timestamptz default now() not null,
  constraint "offer_products_rule_1" unique (offer_id, product_id, variant_id)
);

comment on table public."offer_products" is 'Products/variants explicitly included in an offer.';

-- Promotions: offer_redemptions
create table if not exists public."offer_redemptions" (
  "id" uuid default gen_random_uuid() not null primary key,
  "offer_id" uuid not null,
  "customer_id" uuid not null,
  "order_id" uuid not null,
  "discount_paise" bigint not null,
  "created_at" timestamptz default now() not null,
  constraint "offer_redemptions_rule_1" unique (offer_id, customer_id, order_id),
  constraint "offer_redemptions_discount_paise_nonnegative" check ("discount_paise" is null or "discount_paise" >= 0)
);

comment on table public."offer_redemptions" is 'Immutable application of an offer to a completed/placed order.';
