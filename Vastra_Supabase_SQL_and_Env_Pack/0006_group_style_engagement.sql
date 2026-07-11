-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


-- Engagement: shop_favourites
create table if not exists public."shop_favourites" (
  "id" uuid default gen_random_uuid() not null primary key,
  "customer_id" uuid not null,
  "shop_id" uuid not null,
  "source" text default 'SHOP_PAGE' not null,
  "new_arrival_notifications" boolean default true not null,
  "offer_notifications" boolean default true not null,
  "restock_notifications" boolean default true not null,
  "favourited_at" timestamptz default now() not null,
  "unfavourited_at" timestamptz,
  constraint "shop_favourites_rule_1" unique (customer_id, shop_id),
  constraint "shop_favourites_source_check" check ("source" in ('ORGANIC_SEARCH', 'SHOP_PAGE', 'MERCHANT_REQUEST', 'ORDER_HISTORY', 'PRODUCT_PAGE', 'CAMPAIGN'))
);

comment on table public."shop_favourites" is 'Customer-to-shop follow/favourite relationship created voluntarily after search, visit or merchant request.';

-- Engagement: wishlist_items
create table if not exists public."wishlist_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "customer_id" uuid not null,
  "product_id" uuid not null,
  "variant_id" uuid,
  "created_at" timestamptz default now() not null,
  constraint "wishlist_items_rule_1" unique (customer_id, product_id, variant_id)
);

comment on table public."wishlist_items" is 'Customer product/variant wishlist.';

-- Group Style: style_groups
create table if not exists public."style_groups" (
  "id" uuid default gen_random_uuid() not null primary key,
  "creator_customer_id" uuid not null,
  "name" text not null,
  "occasion_type" text not null,
  "custom_occasion_name" text,
  "event_start_date" date,
  "event_end_date" date,
  "location_name" text,
  "event_location" geography(Point,4326),
  "budget_min_paise" bigint,
  "budget_max_paise" bigint,
  "coordination_mode" text default 'COORDINATED_LOOKS' not null,
  "include_footwear" boolean default true not null,
  "include_accessories" boolean default true not null,
  "status" text default 'PLANNING' not null,
  "invite_code" text not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "style_groups_invite_code_key" unique ("invite_code"),
  constraint "style_groups_occasion_type_check" check ("occasion_type" in ('WEDDING', 'PARTY', 'TRIP', 'FESTIVAL', 'GET_TOGETHER', 'COLLEGE_EVENT', 'OFFICE_EVENT', 'PHOTOSHOOT', 'CUSTOM')),
  constraint "style_groups_budget_min_paise_nonnegative" check ("budget_min_paise" is null or "budget_min_paise" >= 0),
  constraint "style_groups_budget_max_paise_nonnegative" check ("budget_max_paise" is null or "budget_max_paise" >= 0),
  constraint "style_groups_coordination_mode_check" check ("coordination_mode" in ('SAME_OUTFIT', 'SAME_COLOUR', 'SAME_COLOUR_FAMILY', 'SAME_THEME', 'MATCHING_ACCESSORIES', 'COORDINATED_LOOKS')),
  constraint "style_groups_status_check" check ("status" in ('PLANNING', 'VOTING', 'FINALIZED', 'ORDERING', 'COMPLETED', 'ARCHIVED'))
);

comment on table public."style_groups" is 'Occasion-planning group for wedding, party, trip, festival, get-together and custom events.';

-- Group Style: style_group_members
create table if not exists public."style_group_members" (
  "id" uuid default gen_random_uuid() not null primary key,
  "group_id" uuid not null,
  "customer_id" uuid,
  "invited_phone" text,
  "display_name" text not null,
  "event_role" text,
  "membership_role" text default 'MEMBER' not null,
  "status" text default 'INVITED' not null,
  "joined_at" timestamptz,
  "created_at" timestamptz default now() not null,
  constraint "style_group_members_rule_1" unique (group_id, customer_id),
  constraint "style_group_members_membership_role_check" check ("membership_role" in ('ADMIN', 'MEMBER')),
  constraint "style_group_members_status_check" check ("status" in ('INVITED', 'JOINED', 'DECLINED', 'REMOVED', 'LEFT'))
);

comment on table public."style_group_members" is 'Invited and joined participants, including event roles such as bride, groom, friends or family.';

-- Group Style: style_group_member_preferences
create table if not exists public."style_group_member_preferences" (
  "id" uuid default gen_random_uuid() not null primary key,
  "group_member_id" uuid not null,
  "clothing_size" text,
  "footwear_size" text,
  "preferred_colours" text[] default '{}'::text[] not null,
  "avoided_colours" text[] default '{}'::text[] not null,
  "preferred_styles" text[] default '{}'::text[] not null,
  "budget_min_paise" bigint,
  "budget_max_paise" bigint,
  "include_footwear" boolean default true not null,
  "include_accessories" boolean default true not null,
  "private_body_profile_id" uuid,
  "updated_at" timestamptz default now() not null,
  constraint "style_group_member_preferences_rule_1" unique (group_member_id),
  constraint "style_group_member_preferences_budget_min_paise_nonnegative" check ("budget_min_paise" is null or "budget_min_paise" >= 0),
  constraint "style_group_member_preferences_budget_max_paise_nonnegative" check ("budget_max_paise" is null or "budget_max_paise" >= 0)
);

comment on table public."style_group_member_preferences" is 'Private size, footwear, budget and style preferences for one group member.';

-- Group Style: style_themes
create table if not exists public."style_themes" (
  "id" uuid default gen_random_uuid() not null primary key,
  "group_id" uuid not null,
  "name" text not null,
  "primary_colours" text[] default '{}'::text[] not null,
  "secondary_colours" text[] default '{}'::text[] not null,
  "style_tags" text[] default '{}'::text[] not null,
  "material_preferences" text[] default '{}'::text[] not null,
  "formality_level" text,
  "weather_context" jsonb default '{}'::jsonb not null,
  "created_by" uuid not null,
  "is_selected" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

comment on table public."style_themes" is 'Colour palette, visual style, material and formality rules selected by a group.';

-- Group Style: style_polls
create table if not exists public."style_polls" (
  "id" uuid default gen_random_uuid() not null primary key,
  "group_id" uuid not null,
  "question" text not null,
  "poll_type" text not null,
  "allows_multiple" boolean default false not null,
  "closes_at" timestamptz,
  "status" text default 'OPEN' not null,
  "created_by" uuid not null,
  "created_at" timestamptz default now() not null,
  constraint "style_polls_poll_type_check" check ("poll_type" in ('COLOUR', 'THEME', 'PRODUCT', 'MERCHANT', 'BUDGET', 'CUSTOM')),
  constraint "style_polls_status_check" check ("status" in ('OPEN', 'CLOSED', 'CANCELLED'))
);

comment on table public."style_polls" is 'Group polls for colours, themes, products, merchants or budgets.';

-- Group Style: style_poll_options
create table if not exists public."style_poll_options" (
  "id" uuid default gen_random_uuid() not null primary key,
  "poll_id" uuid not null,
  "label" text not null,
  "product_id" uuid,
  "theme_id" uuid,
  "image_path" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "display_order" integer default 0 not null,
  "created_at" timestamptz default now() not null
);

comment on table public."style_poll_options" is 'Selectable poll options that can reference a theme, product or free text.';

-- Group Style: style_poll_votes
create table if not exists public."style_poll_votes" (
  "id" uuid default gen_random_uuid() not null primary key,
  "poll_id" uuid not null,
  "option_id" uuid not null,
  "group_member_id" uuid not null,
  "created_at" timestamptz default now() not null,
  constraint "style_poll_votes_rule_1" unique (poll_id, option_id, group_member_id)
);

comment on table public."style_poll_votes" is 'One member vote per poll option, constrained by poll rules.';

-- Group Style: style_moodboards
create table if not exists public."style_moodboards" (
  "id" uuid default gen_random_uuid() not null primary key,
  "group_id" uuid not null,
  "theme_id" uuid,
  "name" text not null,
  "cover_image_path" text,
  "status" text default 'DRAFT' not null,
  "created_by" uuid not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "style_moodboards_status_check" check ("status" in ('DRAFT', 'SHARED', 'FINAL'))
);

comment on table public."style_moodboards" is 'Shareable group mood board containing colour palette, member looks and accessories.';

-- Group Style: style_moodboard_items
create table if not exists public."style_moodboard_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "moodboard_id" uuid not null,
  "group_member_id" uuid,
  "product_id" uuid,
  "variant_id" uuid,
  "item_type" text not null,
  "item_role" text,
  "position_data" jsonb default '{}'::jsonb not null,
  "created_at" timestamptz default now() not null,
  constraint "style_moodboard_items_item_type_check" check ("item_type" in ('PRODUCT', 'COLOUR_SWATCH', 'TEXT', 'IMAGE'))
);

comment on table public."style_moodboard_items" is 'Products, palettes and member recommendation cards positioned on a mood board.';

-- Notifications: notifications
create table if not exists public."notifications" (
  "id" uuid default gen_random_uuid() not null primary key,
  "user_id" uuid not null,
  "notification_type" text not null,
  "title" text not null,
  "body" text not null,
  "entity_type" text,
  "entity_id" uuid,
  "priority" text default 'NORMAL' not null,
  "data" jsonb default '{}'::jsonb not null,
  "created_at" timestamptz default now() not null,
  "read_at" timestamptz,
  constraint "notifications_priority_check" check ("priority" in ('LOW', 'NORMAL', 'HIGH', 'URGENT'))
);

comment on table public."notifications" is 'In-app notification record for customer, merchant, captain and admin users.';

-- Notifications: notification_deliveries
create table if not exists public."notification_deliveries" (
  "id" bigint default generated always as identity not null primary key,
  "notification_id" uuid not null,
  "device_id" uuid,
  "channel" text not null,
  "provider" text,
  "provider_message_id" text,
  "status" text default 'PENDING' not null,
  "attempt_count" smallint default 0 not null,
  "sent_at" timestamptz,
  "received_at" timestamptz,
  "failed_reason" text,
  "created_at" timestamptz default now() not null,
  constraint "notification_deliveries_channel_check" check ("channel" in ('PUSH', 'SMS', 'WHATSAPP', 'EMAIL', 'IN_APP')),
  constraint "notification_deliveries_status_check" check ("status" in ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
  constraint "notification_deliveries_attempt_count_nonnegative" check ("attempt_count" is null or "attempt_count" >= 0)
);

comment on table public."notification_deliveries" is 'Channel-specific send, retry and delivery receipt history.';

-- Notifications: notification_preferences
create table if not exists public."notification_preferences" (
  "user_id" uuid not null primary key,
  "order_updates" boolean default true not null,
  "delivery_updates" boolean default true not null,
  "shop_offers" boolean default true not null,
  "new_arrivals" boolean default true not null,
  "recommendations" boolean default true not null,
  "group_updates" boolean default true not null,
  "support_updates" boolean default true not null,
  "quiet_hours_start" time,
  "quiet_hours_end" time,
  "updated_at" timestamptz default now() not null
);

comment on table public."notification_preferences" is 'Global non-transactional notification preferences. Critical order and security alerts are controlled separately.';

-- Engagement: reviews
create table if not exists public."reviews" (
  "id" uuid default gen_random_uuid() not null primary key,
  "order_id" uuid not null,
  "customer_id" uuid not null,
  "review_type" text not null,
  "shop_id" uuid,
  "product_id" uuid,
  "captain_id" uuid,
  "rating" smallint not null,
  "review_text" text,
  "moderation_status" text default 'PUBLISHED' not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "reviews_review_type_check" check ("review_type" in ('PRODUCT', 'SHOP', 'CAPTAIN')),
  constraint "reviews_rating_check" check (rating between 1 and 5),
  constraint "reviews_moderation_status_check" check ("moderation_status" in ('PUBLISHED', 'PENDING', 'HIDDEN', 'REJECTED'))
);

comment on table public."reviews" is 'Verified-order reviews for product, shop and captain.';
