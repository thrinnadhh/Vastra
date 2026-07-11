-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


-- Intelligence: customer_events
create table if not exists public."customer_events" (
  "id" bigint default generated always as identity not null primary key,
  "customer_id" uuid,
  "anonymous_id" uuid,
  "session_id" uuid not null,
  "app_name" text default 'CUSTOMER' not null,
  "event_type" text not null,
  "entity_type" text,
  "entity_id" uuid,
  "shop_id" uuid,
  "query_text" text,
  "context" jsonb default '{}'::jsonb not null,
  "occurred_at" timestamptz default now() not null,
  "received_at" timestamptz default now() not null,
  constraint "customer_events_event_type_check" check ("event_type" in ('PRODUCT_VIEW', 'PRODUCT_CLICK', 'SEARCH', 'SHOP_VIEW', 'FAVOURITE_SHOP', 'WISHLIST_ADD', 'CART_ADD', 'PURCHASE', 'RETURN', 'GROUP_SELECTION', 'FIT_FEEDBACK'))
);

comment on table public."customer_events" is 'High-volume behavioural event stream for recommendation training and analytics.';

-- Intelligence: recommendation_sets
create table if not exists public."recommendation_sets" (
  "id" uuid default gen_random_uuid() not null primary key,
  "customer_id" uuid,
  "session_id" uuid,
  "recommendation_type" text not null,
  "context" jsonb default '{}'::jsonb not null,
  "algorithm_version" text default 'rules-v1' not null,
  "generated_at" timestamptz default now() not null,
  "expires_at" timestamptz,
  constraint "recommendation_sets_recommendation_type_check" check ("recommendation_type" in ('HOME_PERSONALIZED', 'SIMILAR_PRODUCTS', 'COMPLETE_THE_LOOK', 'TRENDING_NEARBY', 'BASED_ON_OCCASION', 'BASED_ON_FAVOURITE_SHOP', 'GROUP_STYLE'))
);

comment on table public."recommendation_sets" is 'One generated ranking for a customer and context.';

-- Intelligence: recommendation_items
create table if not exists public."recommendation_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "recommendation_set_id" uuid not null,
  "product_id" uuid not null,
  "variant_id" uuid,
  "rank_position" integer not null,
  "score" numeric(10,8) not null,
  "reason_codes" text[] default '{}'::text[] not null,
  "score_components" jsonb default '{}'::jsonb not null,
  "shown_at" timestamptz,
  "clicked_at" timestamptz,
  "purchased_at" timestamptz,
  "created_at" timestamptz default now() not null,
  constraint "recommendation_items_rule_1" unique (recommendation_set_id, rank_position),
  constraint "recommendation_items_rank_position_nonnegative" check ("rank_position" is null or "rank_position" >= 0)
);

comment on table public."recommendation_items" is 'Ranked recommendation output with explanation and engagement timestamps.';

-- Intelligence: product_embeddings
create table if not exists public."product_embeddings" (
  "product_id" uuid not null primary key,
  "embedding_type" text default 'MULTIMODAL' not null,
  "embedding" vector(768) not null,
  "model_version" text not null,
  "source_hash" text not null,
  "updated_at" timestamptz default now() not null
);

comment on table public."product_embeddings" is 'Vector representation for image/text similarity and outfit compatibility.';

-- Intelligence: customer_embeddings
create table if not exists public."customer_embeddings" (
  "customer_id" uuid not null primary key,
  "embedding" vector(768) not null,
  "model_version" text not null,
  "source_event_count" integer default 0 not null,
  "updated_at" timestamptz default now() not null,
  constraint "customer_embeddings_source_event_count_nonnegative" check ("source_event_count" is null or "source_event_count" >= 0)
);

comment on table public."customer_embeddings" is 'Learned customer preference vector for ML ranking.';

-- Intelligence: size_charts
create table if not exists public."size_charts" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_id" uuid,
  "brand" text,
  "category_id" uuid not null,
  "gender_category" text default 'UNISEX' not null,
  "country_standard" text default 'IN' not null,
  "name" text not null,
  "version" integer default 1 not null,
  "is_active" boolean default true not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "size_charts_version_nonnegative" check ("version" is null or "version" >= 0)
);

comment on table public."size_charts" is 'Brand/shop/category size-chart version.';

-- Intelligence: size_chart_measurements
create table if not exists public."size_chart_measurements" (
  "id" uuid default gen_random_uuid() not null primary key,
  "size_chart_id" uuid not null,
  "size_label" text not null,
  "measurement_name" text not null,
  "min_cm" numeric(8,2),
  "max_cm" numeric(8,2),
  "garment_measurement_cm" numeric(8,2),
  "tolerance_cm" numeric(8,2),
  "created_at" timestamptz default now() not null,
  constraint "size_chart_measurements_rule_1" unique (size_chart_id, size_label, measurement_name),
  constraint "size_chart_measurements_min_cm_nonnegative" check ("min_cm" is null or "min_cm" >= 0),
  constraint "size_chart_measurements_max_cm_nonnegative" check ("max_cm" is null or "max_cm" >= 0),
  constraint "size_chart_measurements_garment_measurement_cm_nonnegative" check ("garment_measurement_cm" is null or "garment_measurement_cm" >= 0),
  constraint "size_chart_measurements_tolerance_cm_nonnegative" check ("tolerance_cm" is null or "tolerance_cm" >= 0)
);

comment on table public."size_chart_measurements" is 'Measurement ranges and garment dimensions for each label in a size chart.';

-- Intelligence: customer_body_profiles
create table if not exists public."customer_body_profiles" (
  "id" uuid default gen_random_uuid() not null primary key,
  "customer_id" uuid not null,
  "profile_name" text default 'My Fit Profile' not null,
  "source" text default 'MANUAL_ENTRY' not null,
  "fit_preference" text default 'REGULAR' not null,
  "height_cm" numeric(8,2),
  "weight_kg" numeric(8,2),
  "consent_version" text not null,
  "consent_given_at" timestamptz not null,
  "is_active" boolean default true not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "deleted_at" timestamptz,
  constraint "customer_body_profiles_source_check" check ("source" in ('MANUAL_ENTRY', 'CAMERA_SCAN', 'PURCHASE_HISTORY')),
  constraint "customer_body_profiles_fit_preference_check" check ("fit_preference" in ('SLIM', 'REGULAR', 'RELAXED', 'OVERSIZED')),
  constraint "customer_body_profiles_height_cm_nonnegative" check ("height_cm" is null or "height_cm" >= 0),
  constraint "customer_body_profiles_weight_kg_nonnegative" check ("weight_kg" is null or "weight_kg" >= 0)
);

comment on table public."customer_body_profiles" is 'Consent-controlled body profile for manual measurements, camera scan or learned fit history.';

-- Intelligence: body_measurements
create table if not exists public."body_measurements" (
  "id" uuid default gen_random_uuid() not null primary key,
  "body_profile_id" uuid not null,
  "measurement_name" text not null,
  "value_cm" numeric(8,2) not null,
  "confidence_score" numeric(6,5),
  "source" text not null,
  "captured_at" timestamptz default now() not null,
  constraint "body_measurements_rule_1" unique (body_profile_id, measurement_name),
  constraint "body_measurements_value_cm_nonnegative" check ("value_cm" is null or "value_cm" >= 0),
  constraint "body_measurements_confidence_score_nonnegative" check ("confidence_score" is null or "confidence_score" >= 0),
  constraint "body_measurements_source_check" check ("source" in ('USER_ENTERED', 'CAMERA_ESTIMATED', 'PURCHASE_LEARNED'))
);

comment on table public."body_measurements" is 'Individual measurements with confidence and source.';

-- Intelligence: body_scan_sessions
create table if not exists public."body_scan_sessions" (
  "id" uuid default gen_random_uuid() not null primary key,
  "customer_id" uuid not null,
  "body_profile_id" uuid,
  "status" text default 'CREATED' not null,
  "front_image_path" text,
  "side_image_path" text,
  "back_image_path" text,
  "processing_provider" text,
  "model_version" text,
  "quality_score" numeric(6,5),
  "quality_issues" text[] default '{}'::text[] not null,
  "error_message" text,
  "deletion_scheduled_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "completed_at" timestamptz,
  constraint "body_scan_sessions_status_check" check ("status" in ('CREATED', 'UPLOADING', 'QUALITY_CHECK', 'PROCESSING', 'COMPLETED', 'FAILED', 'DELETED')),
  constraint "body_scan_sessions_quality_score_check" check (quality_score between 0 and 1)
);

comment on table public."body_scan_sessions" is 'Privacy-sensitive guided body scan processing session. Raw images should be deleted by default after extraction.';

-- Intelligence: fit_recommendations
create table if not exists public."fit_recommendations" (
  "id" uuid default gen_random_uuid() not null primary key,
  "customer_id" uuid not null,
  "body_profile_id" uuid,
  "product_id" uuid not null,
  "variant_id" uuid,
  "recommended_size" text not null,
  "confidence_score" numeric(6,5) not null,
  "fit_prediction" text default 'EXPECTED_FIT' not null,
  "reason_codes" text[] default '{}'::text[] not null,
  "inputs_snapshot" jsonb default '{}'::jsonb not null,
  "model_version" text default 'rules-v1' not null,
  "created_at" timestamptz default now() not null,
  constraint "fit_recommendations_confidence_score_check" check (confidence_score between 0 and 1),
  constraint "fit_recommendations_fit_prediction_check" check ("fit_prediction" in ('TOO_SMALL', 'SLIGHTLY_SMALL', 'EXPECTED_FIT', 'SLIGHTLY_LARGE', 'TOO_LARGE'))
);

comment on table public."fit_recommendations" is 'Per-product size recommendation, confidence, explanation and model version.';

-- Intelligence: fit_feedback
create table if not exists public."fit_feedback" (
  "id" uuid default gen_random_uuid() not null primary key,
  "customer_id" uuid not null,
  "order_item_id" uuid not null,
  "fit_recommendation_id" uuid,
  "predicted_size" text,
  "purchased_size" text not null,
  "feedback" text not null,
  "returned_due_to_fit" boolean default false not null,
  "created_at" timestamptz default now() not null,
  constraint "fit_feedback_rule_1" unique (order_item_id),
  constraint "fit_feedback_feedback_check" check ("feedback" in ('TOO_SMALL', 'SLIGHTLY_SMALL', 'PERFECT', 'SLIGHTLY_LARGE', 'TOO_LARGE'))
);

comment on table public."fit_feedback" is 'Post-delivery fit outcome used to improve brand/product sizing.';

-- Intelligence: virtual_tryon_sessions
create table if not exists public."virtual_tryon_sessions" (
  "id" uuid default gen_random_uuid() not null primary key,
  "customer_id" uuid not null,
  "product_id" uuid not null,
  "variant_id" uuid,
  "input_type" text not null,
  "customer_image_path" text,
  "body_profile_id" uuid,
  "status" text default 'CREATED' not null,
  "provider" text,
  "model_version" text,
  "consent_version" text not null,
  "deletion_scheduled_at" timestamptz,
  "error_message" text,
  "created_at" timestamptz default now() not null,
  "completed_at" timestamptz,
  constraint "virtual_tryon_sessions_input_type_check" check ("input_type" in ('UPLOADED_PHOTO', 'SAVED_BODY_PROFILE', 'GENERIC_MODEL')),
  constraint "virtual_tryon_sessions_status_check" check ("status" in ('CREATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DELETED'))
);

comment on table public."virtual_tryon_sessions" is 'Photo/avatar virtual try-on job with provider/model, consent and retention state.';

-- Intelligence: virtual_tryon_outputs
create table if not exists public."virtual_tryon_outputs" (
  "id" uuid default gen_random_uuid() not null primary key,
  "tryon_session_id" uuid not null,
  "view_type" text default 'FRONT' not null,
  "output_image_path" text not null,
  "quality_score" numeric(6,5),
  "is_saved_by_customer" boolean default false not null,
  "created_at" timestamptz default now() not null,
  constraint "virtual_tryon_outputs_view_type_check" check ("view_type" in ('FRONT', 'SIDE', 'BACK', 'GROUP_MOODBOARD')),
  constraint "virtual_tryon_outputs_quality_score_check" check (quality_score between 0 and 1)
);

comment on table public."virtual_tryon_outputs" is 'Generated front/side/back try-on output references.';

-- Intelligence: style_recommendation_sets
create table if not exists public."style_recommendation_sets" (
  "id" uuid default gen_random_uuid() not null primary key,
  "group_id" uuid not null,
  "theme_id" uuid,
  "algorithm_version" text default 'rules-v1' not null,
  "total_score" numeric(10,8) default 0 not null,
  "score_components" jsonb default '{}'::jsonb not null,
  "status" text default 'GENERATED' not null,
  "created_at" timestamptz default now() not null,
  constraint "style_recommendation_sets_status_check" check ("status" in ('GENERATED', 'SHORTLISTED', 'SELECTED', 'EXPIRED'))
);

comment on table public."style_recommendation_sets" is 'Scored coordinated set for a group theme and members.';

-- Intelligence: style_recommendation_items
create table if not exists public."style_recommendation_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "recommendation_set_id" uuid not null,
  "group_member_id" uuid not null,
  "product_id" uuid not null,
  "variant_id" uuid,
  "item_role" text not null,
  "compatibility_score" numeric(10,8) default 0 not null,
  "availability_score" numeric(10,8) default 0 not null,
  "reason_codes" text[] default '{}'::text[] not null,
  "created_at" timestamptz default now() not null
);

comment on table public."style_recommendation_items" is 'Member-level clothing, footwear and accessory products in a coordinated group set.';
