-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


-- Commerce: offline_sales
create table if not exists public."offline_sales" (
  "id" uuid default gen_random_uuid() not null primary key,
  "sale_number" text not null,
  "shop_id" uuid not null,
  "merchant_id" uuid not null,
  "customer_phone" text,
  "subtotal_paise" bigint default 0 not null,
  "discount_paise" bigint default 0 not null,
  "tax_paise" bigint default 0 not null,
  "total_paise" bigint default 0 not null,
  "payment_method" text not null,
  "status" text default 'COMPLETED' not null,
  "recorded_by" uuid not null,
  "created_at" timestamptz default now() not null,
  "voided_at" timestamptz,
  constraint "offline_sales_sale_number_key" unique ("sale_number"),
  constraint "offline_sales_subtotal_paise_nonnegative" check ("subtotal_paise" is null or "subtotal_paise" >= 0),
  constraint "offline_sales_discount_paise_nonnegative" check ("discount_paise" is null or "discount_paise" >= 0),
  constraint "offline_sales_tax_paise_nonnegative" check ("tax_paise" is null or "tax_paise" >= 0),
  constraint "offline_sales_total_paise_nonnegative" check ("total_paise" is null or "total_paise" >= 0),
  constraint "offline_sales_payment_method_check" check ("payment_method" in ('CASH', 'UPI', 'CARD', 'OTHER')),
  constraint "offline_sales_status_check" check ("status" in ('DRAFT', 'COMPLETED', 'VOIDED', 'REFUNDED'))
);

comment on table public."offline_sales" is 'Physical shop sale recorded by barcode, photo match or manual product selection so online inventory stays accurate.';

-- Commerce: offline_sale_items
create table if not exists public."offline_sale_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "offline_sale_id" uuid not null,
  "variant_id" uuid not null,
  "quantity" integer not null,
  "unit_price_paise" bigint not null,
  "discount_paise" bigint default 0 not null,
  "total_paise" bigint not null,
  "identification_method" text default 'MANUAL_SEARCH' not null,
  "created_at" timestamptz default now() not null,
  constraint "offline_sale_items_quantity_nonnegative" check ("quantity" is null or "quantity" >= 0),
  constraint "offline_sale_items_unit_price_paise_nonnegative" check ("unit_price_paise" is null or "unit_price_paise" >= 0),
  constraint "offline_sale_items_discount_paise_nonnegative" check ("discount_paise" is null or "discount_paise" >= 0),
  constraint "offline_sale_items_total_paise_nonnegative" check ("total_paise" is null or "total_paise" >= 0),
  constraint "offline_sale_items_identification_method_check" check ("identification_method" in ('BARCODE', 'PHOTO_MATCH', 'MANUAL_SEARCH'))
);

comment on table public."offline_sale_items" is 'Line items in a physical shop sale.';

-- Commerce: carts
create table if not exists public."carts" (
  "id" uuid default gen_random_uuid() not null primary key,
  "customer_id" uuid not null,
  "shop_id" uuid not null,
  "status" text default 'ACTIVE' not null,
  "coupon_code" text,
  "expires_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "carts_status_check" check ("status" in ('ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED'))
);

comment on table public."carts" is 'One active single-shop cart per customer in the MVP.';

-- Commerce: cart_items
create table if not exists public."cart_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "cart_id" uuid not null,
  "variant_id" uuid not null,
  "quantity" integer default 1 not null,
  "unit_price_snapshot_paise" bigint not null,
  "added_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "cart_items_rule_1" unique (cart_id, variant_id),
  constraint "cart_items_quantity_nonnegative" check ("quantity" is null or "quantity" >= 0),
  constraint "cart_items_unit_price_snapshot_paise_nonnegative" check ("unit_price_snapshot_paise" is null or "unit_price_snapshot_paise" >= 0)
);

comment on table public."cart_items" is 'Variant-level cart lines with price snapshots for display; final prices are revalidated at order placement.';

-- Commerce: orders
create table if not exists public."orders" (
  "id" uuid default gen_random_uuid() not null primary key,
  "order_number" text not null,
  "customer_id" uuid not null,
  "shop_id" uuid not null,
  "cart_id" uuid,
  "style_group_id" uuid,
  "delivery_address_id" uuid not null,
  "address_snapshot" jsonb default '{}'::jsonb not null,
  "status" text default 'PAYMENT_PENDING' not null,
  "payment_status" text default 'PENDING' not null,
  "fulfilment_type" text default 'DELIVERY' not null,
  "subtotal_paise" bigint default 0 not null,
  "product_discount_paise" bigint default 0 not null,
  "coupon_discount_paise" bigint default 0 not null,
  "delivery_fee_paise" bigint default 0 not null,
  "platform_fee_paise" bigint default 0 not null,
  "tax_paise" bigint default 0 not null,
  "total_paise" bigint default 0 not null,
  "merchant_preparation_minutes" integer,
  "estimated_delivery_at" timestamptz,
  "customer_note" text,
  "cancellation_reason_code" text,
  "cancellation_note" text,
  "version" integer default 1 not null,
  "placed_at" timestamptz,
  "accepted_at" timestamptz,
  "ready_at" timestamptz,
  "picked_up_at" timestamptz,
  "delivered_at" timestamptz,
  "cancelled_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "orders_order_number_key" unique ("order_number"),
  constraint "orders_status_check" check ("status" in ('PAYMENT_PENDING', 'WAITING_FOR_MERCHANT', 'MERCHANT_ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'CAPTAIN_SEARCHING', 'CAPTAIN_ASSIGNED', 'CAPTAIN_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'CAPTAIN_AT_CUSTOMER', 'DELIVERED', 'COMPLETED', 'PROBLEM_REPORTED', 'CANCELLED')),
  constraint "orders_payment_status_check" check ("payment_status" in ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'COD_PENDING', 'COD_COLLECTED')),
  constraint "orders_fulfilment_type_check" check ("fulfilment_type" in ('DELIVERY', 'CUSTOMER_PICKUP')),
  constraint "orders_subtotal_paise_nonnegative" check ("subtotal_paise" is null or "subtotal_paise" >= 0),
  constraint "orders_product_discount_paise_nonnegative" check ("product_discount_paise" is null or "product_discount_paise" >= 0),
  constraint "orders_coupon_discount_paise_nonnegative" check ("coupon_discount_paise" is null or "coupon_discount_paise" >= 0),
  constraint "orders_delivery_fee_paise_nonnegative" check ("delivery_fee_paise" is null or "delivery_fee_paise" >= 0),
  constraint "orders_platform_fee_paise_nonnegative" check ("platform_fee_paise" is null or "platform_fee_paise" >= 0),
  constraint "orders_tax_paise_nonnegative" check ("tax_paise" is null or "tax_paise" >= 0),
  constraint "orders_total_paise_nonnegative" check ("total_paise" is null or "total_paise" >= 0),
  constraint "orders_merchant_preparation_minutes_nonnegative" check ("merchant_preparation_minutes" is null or "merchant_preparation_minutes" >= 0),
  constraint "orders_version_nonnegative" check ("version" is null or "version" >= 0)
);

comment on table public."orders" is 'Authoritative customer order header and current lifecycle state.';

-- Commerce: order_items
create table if not exists public."order_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "order_id" uuid not null,
  "product_id" uuid not null,
  "variant_id" uuid not null,
  "product_name_snapshot" text not null,
  "sku_snapshot" text not null,
  "colour_snapshot" text,
  "size_snapshot" text,
  "image_path_snapshot" text,
  "quantity" integer not null,
  "unit_mrp_paise" bigint not null,
  "unit_selling_price_paise" bigint not null,
  "discount_paise" bigint default 0 not null,
  "total_paise" bigint not null,
  "fulfilment_status" text default 'PENDING' not null,
  "created_at" timestamptz default now() not null,
  constraint "order_items_quantity_nonnegative" check ("quantity" is null or "quantity" >= 0),
  constraint "order_items_unit_mrp_paise_nonnegative" check ("unit_mrp_paise" is null or "unit_mrp_paise" >= 0),
  constraint "order_items_unit_selling_price_paise_nonnegative" check ("unit_selling_price_paise" is null or "unit_selling_price_paise" >= 0),
  constraint "order_items_discount_paise_nonnegative" check ("discount_paise" is null or "discount_paise" >= 0),
  constraint "order_items_total_paise_nonnegative" check ("total_paise" is null or "total_paise" >= 0),
  constraint "order_items_fulfilment_status_check" check ("fulfilment_status" in ('PENDING', 'VERIFIED', 'PACKED', 'HANDED_OVER', 'RETURNED', 'CANCELLED'))
);

comment on table public."order_items" is 'Immutable product and price snapshots for each exact ordered variant.';

-- Commerce: order_status_history
create table if not exists public."order_status_history" (
  "id" bigint default generated always as identity not null primary key,
  "order_id" uuid not null,
  "previous_status" text,
  "new_status" text not null,
  "changed_by_user_id" uuid,
  "changed_by_role" text default 'SYSTEM' not null,
  "reason_code" text,
  "note" text,
  "location" geography(Point,4326),
  "created_at" timestamptz default now() not null
);

comment on table public."order_status_history" is 'Append-only timeline for every state transition and operational reason.';

-- Commerce: merchant_order_alerts
create table if not exists public."merchant_order_alerts" (
  "id" uuid default gen_random_uuid() not null primary key,
  "order_id" uuid not null,
  "shop_id" uuid not null,
  "device_id" uuid,
  "alert_status" text default 'PENDING' not null,
  "attempt_count" smallint default 0 not null,
  "first_sent_at" timestamptz,
  "last_sent_at" timestamptz,
  "acknowledged_at" timestamptz,
  "acknowledged_by" uuid,
  "expires_at" timestamptz not null,
  "sound_name" text default 'vastra_new_order' not null,
  "failure_reason" text,
  "created_at" timestamptz default now() not null,
  constraint "merchant_order_alerts_alert_status_check" check ("alert_status" in ('PENDING', 'SENT', 'DELIVERED', 'ACKNOWLEDGED', 'EXPIRED', 'FAILED')),
  constraint "merchant_order_alerts_attempt_count_check" check (attempt_count between 0 and 20)
);

comment on table public."merchant_order_alerts" is 'Tracks every urgent order alert, retry, delivery and acknowledgement for the merchant ringing experience.';

-- Commerce: merchant_order_issues
create table if not exists public."merchant_order_issues" (
  "id" uuid default gen_random_uuid() not null primary key,
  "order_id" uuid not null,
  "order_item_id" uuid,
  "issue_type" text not null,
  "description" text,
  "evidence_path" text,
  "reported_by" uuid not null,
  "resolution_status" text default 'OPEN' not null,
  "resolved_by" uuid,
  "resolution_note" text,
  "created_at" timestamptz default now() not null,
  "resolved_at" timestamptz,
  constraint "merchant_order_issues_issue_type_check" check ("issue_type" in ('OUT_OF_STOCK', 'SIZE_UNAVAILABLE', 'COLOUR_UNAVAILABLE', 'DAMAGED_ITEM', 'INVENTORY_MISMATCH', 'ITEM_NOT_FOUND', 'PRICING_ERROR', 'SHOP_BUSY', 'SHOP_CLOSING', 'OTHER')),
  constraint "merchant_order_issues_resolution_status_check" check ("resolution_status" in ('OPEN', 'ACCEPTED', 'REPLACEMENT_REQUESTED', 'RESOLVED', 'REJECTED'))
);

comment on table public."merchant_order_issues" is 'Merchant-reported inability to fulfil an order because of stock, size, colour, damage, pricing or operational issues.';

-- Commerce: order_item_verifications
create table if not exists public."order_item_verifications" (
  "id" uuid default gen_random_uuid() not null primary key,
  "order_item_id" uuid not null,
  "verification_method" text not null,
  "scanned_barcode" text,
  "photo_path" text,
  "verified_variant_id" uuid,
  "result" text not null,
  "verified_by" uuid not null,
  "verified_at" timestamptz default now() not null,
  "override_reason" text,
  constraint "order_item_verifications_verification_method_check" check ("verification_method" in ('BARCODE', 'PHOTO', 'MANUAL')),
  constraint "order_item_verifications_result_check" check ("result" in ('MATCH', 'MISMATCH', 'OVERRIDDEN'))
);

comment on table public."order_item_verifications" is 'Packing verification result using barcode, photo or manual confirmation.';

-- Payments: payments
create table if not exists public."payments" (
  "id" uuid default gen_random_uuid() not null primary key,
  "order_id" uuid not null,
  "customer_id" uuid not null,
  "provider" text not null,
  "provider_order_id" text,
  "provider_payment_id" text,
  "method" text not null,
  "amount_paise" bigint not null,
  "currency" text default 'INR' not null,
  "status" text default 'CREATED' not null,
  "signature_verified" boolean default false not null,
  "failure_code" text,
  "failure_message" text,
  "paid_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "payments_method_check" check ("method" in ('UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD', 'OTHER')),
  constraint "payments_amount_paise_nonnegative" check ("amount_paise" is null or "amount_paise" >= 0),
  constraint "payments_status_check" check ("status" in ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED'))
);

comment on table public."payments" is 'Payment attempt and provider identifiers for online and COD orders.';

-- Payments: payment_events
create table if not exists public."payment_events" (
  "id" bigint default generated always as identity not null primary key,
  "payment_id" uuid,
  "provider" text not null,
  "provider_event_id" text not null,
  "event_type" text not null,
  "payload" jsonb not null,
  "signature_valid" boolean default false not null,
  "processing_status" text default 'RECEIVED' not null,
  "processing_error" text,
  "received_at" timestamptz default now() not null,
  "processed_at" timestamptz,
  constraint "payment_events_provider_event_id_key" unique ("provider_event_id"),
  constraint "payment_events_processing_status_check" check ("processing_status" in ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'))
);

comment on table public."payment_events" is 'Idempotent raw gateway webhook/event log.';

-- Returns: return_requests
create table if not exists public."return_requests" (
  "id" uuid default gen_random_uuid() not null primary key,
  "return_number" text not null,
  "order_id" uuid not null,
  "customer_id" uuid not null,
  "shop_id" uuid not null,
  "reason_code" text not null,
  "customer_note" text,
  "status" text default 'REQUESTED' not null,
  "refund_method" text default 'ORIGINAL' not null,
  "requested_at" timestamptz default now() not null,
  "approved_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "return_requests_return_number_key" unique ("return_number"),
  constraint "return_requests_reason_code_check" check ("reason_code" in ('WRONG_SIZE', 'WRONG_COLOUR', 'WRONG_PRODUCT', 'DAMAGED', 'QUALITY', 'DIFFERENT_FROM_IMAGE', 'MISSING_ITEM', 'CHANGED_MIND', 'OTHER')),
  constraint "return_requests_status_check" check ("status" in ('REQUESTED', 'REVIEW', 'APPROVED', 'REJECTED', 'PICKUP_ASSIGNED', 'PICKED_UP', 'RECEIVED', 'VERIFIED', 'REFUND_PENDING', 'REFUNDED', 'CLOSED')),
  constraint "return_requests_refund_method_check" check ("refund_method" in ('ORIGINAL', 'WALLET', 'MANUAL'))
);

comment on table public."return_requests" is 'Customer return request header and current workflow status.';

-- Returns: return_items
create table if not exists public."return_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "return_request_id" uuid not null,
  "order_item_id" uuid not null,
  "quantity" integer default 1 not null,
  "reason_code" text not null,
  "requested_refund_paise" bigint not null,
  "inspection_status" text default 'PENDING' not null,
  "merchant_decision" text,
  "merchant_note" text,
  "inspected_by" uuid,
  "inspected_at" timestamptz,
  constraint "return_items_quantity_nonnegative" check ("quantity" is null or "quantity" >= 0),
  constraint "return_items_requested_refund_paise_nonnegative" check ("requested_refund_paise" is null or "requested_refund_paise" >= 0),
  constraint "return_items_inspection_status_check" check ("inspection_status" in ('PENDING', 'SELLABLE', 'DAMAGED', 'USED', 'WRONG_ITEM', 'DISPUTED')),
  constraint "return_items_merchant_decision_check" check ("merchant_decision" is null or "merchant_decision" in ('ACCEPTED', 'DISPUTED', 'PARTIAL'))
);

comment on table public."return_items" is 'Per-order-item quantities, inspection and merchant decision.';

-- Returns: return_evidence
create table if not exists public."return_evidence" (
  "id" uuid default gen_random_uuid() not null primary key,
  "return_request_id" uuid not null,
  "uploaded_by" uuid not null,
  "evidence_type" text not null,
  "storage_path" text,
  "description" text,
  "created_at" timestamptz default now() not null,
  constraint "return_evidence_evidence_type_check" check ("evidence_type" in ('CUSTOMER_PHOTO', 'MERCHANT_PHOTO', 'CAPTAIN_PHOTO', 'VIDEO', 'DOCUMENT', 'NOTE'))
);

comment on table public."return_evidence" is 'Customer, merchant, captain and admin evidence files for return disputes.';

-- Returns: return_status_history
create table if not exists public."return_status_history" (
  "id" bigint default generated always as identity not null primary key,
  "return_request_id" uuid not null,
  "previous_status" text,
  "new_status" text not null,
  "changed_by" uuid,
  "reason_code" text,
  "note" text,
  "created_at" timestamptz default now() not null
);

comment on table public."return_status_history" is 'Append-only return state timeline.';

-- Payments: refunds
create table if not exists public."refunds" (
  "id" uuid default gen_random_uuid() not null primary key,
  "refund_number" text not null,
  "order_id" uuid not null,
  "payment_id" uuid,
  "return_request_id" uuid,
  "amount_paise" bigint not null,
  "reason_code" text not null,
  "provider_refund_id" text,
  "status" text default 'PENDING' not null,
  "initiated_by" uuid not null,
  "approved_by" uuid,
  "initiated_at" timestamptz,
  "completed_at" timestamptz,
  "failure_message" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "refunds_refund_number_key" unique ("refund_number"),
  constraint "refunds_amount_paise_nonnegative" check ("amount_paise" is null or "amount_paise" >= 0),
  constraint "refunds_status_check" check ("status" in ('PENDING', 'APPROVAL_REQUIRED', 'INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

comment on table public."refunds" is 'Gateway/manual refund record linked to order, payment and optional return.';

-- Finance: merchant_settlements
create table if not exists public."merchant_settlements" (
  "id" uuid default gen_random_uuid() not null primary key,
  "settlement_number" text not null,
  "shop_id" uuid not null,
  "bank_account_id" uuid not null,
  "period_start" date not null,
  "period_end" date not null,
  "gross_sales_paise" bigint default 0 not null,
  "commission_paise" bigint default 0 not null,
  "discount_share_paise" bigint default 0 not null,
  "refund_deduction_paise" bigint default 0 not null,
  "tax_paise" bigint default 0 not null,
  "adjustment_paise" bigint default 0 not null,
  "net_payable_paise" bigint default 0 not null,
  "status" text default 'DRAFT' not null,
  "provider_transfer_id" text,
  "scheduled_at" timestamptz,
  "paid_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "merchant_settlements_settlement_number_key" unique ("settlement_number"),
  constraint "merchant_settlements_status_check" check ("status" in ('DRAFT', 'REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD'))
);

comment on table public."merchant_settlements" is 'Periodic merchant payout batch with commissions, discount share, refunds and adjustments.';

-- Finance: merchant_settlement_items
create table if not exists public."merchant_settlement_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "settlement_id" uuid not null,
  "order_id" uuid,
  "refund_id" uuid,
  "entry_type" text not null,
  "amount_paise" bigint not null,
  "description" text,
  "created_at" timestamptz default now() not null,
  constraint "merchant_settlement_items_entry_type_check" check ("entry_type" in ('ORDER_CREDIT', 'COMMISSION', 'DISCOUNT', 'REFUND', 'TAX', 'PENALTY', 'MANUAL_ADJUSTMENT'))
);

comment on table public."merchant_settlement_items" is 'Settlement ledger rows linking orders, refunds and manual adjustments.';

-- Finance: captain_payouts
create table if not exists public."captain_payouts" (
  "id" uuid default gen_random_uuid() not null primary key,
  "payout_number" text not null,
  "captain_id" uuid not null,
  "period_start" date not null,
  "period_end" date not null,
  "earnings_paise" bigint default 0 not null,
  "incentives_paise" bigint default 0 not null,
  "penalties_paise" bigint default 0 not null,
  "cod_adjustment_paise" bigint default 0 not null,
  "net_payout_paise" bigint default 0 not null,
  "status" text default 'DRAFT' not null,
  "provider_transfer_id" text,
  "paid_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "captain_payouts_payout_number_key" unique ("payout_number"),
  constraint "captain_payouts_status_check" check ("status" in ('DRAFT', 'REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD'))
);

comment on table public."captain_payouts" is 'Periodic captain payout batch including earnings, incentives, penalties and COD adjustments.';

-- Finance: captain_payout_items
create table if not exists public."captain_payout_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "payout_id" uuid not null,
  "captain_earning_id" uuid,
  "entry_type" text not null,
  "amount_paise" bigint not null,
  "description" text,
  "created_at" timestamptz default now() not null,
  constraint "captain_payout_items_entry_type_check" check ("entry_type" in ('EARNING', 'INCENTIVE', 'PENALTY', 'COD_ADJUSTMENT', 'MANUAL_ADJUSTMENT'))
);

comment on table public."captain_payout_items" is 'Links a payout batch to individual captain earning records and adjustments.';
