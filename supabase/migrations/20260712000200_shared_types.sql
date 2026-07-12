-- Shared database foundations for later Vastra schema migrations.
--
-- Forward-fix strategy:
-- - Add new enum values through later ordered migrations.
-- - Never reorder or remove enum values after dependent tables are released.
-- - Replace domains/functions through later compatibility migrations.
--
-- Rollback:
-- Dropping these objects is safe only before dependent tables exist. After that,
-- use a forward-fix migration instead of destructive rollback.

create extension if not exists postgis
with schema extensions;

create type public.account_type as enum (
  'CUSTOMER',
  'MERCHANT',
  'CAPTAIN',
  'ADMIN'
);

create type public.order_status as enum (
  'PAYMENT_PENDING',
  'WAITING_FOR_MERCHANT',
  'MERCHANT_ACCEPTED',
  'PACKING',
  'READY_FOR_PICKUP',
  'CAPTAIN_SEARCHING',
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_AT_STORE',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'CAPTAIN_AT_CUSTOMER',
  'DELIVERED',
  'COMPLETED',
  'PROBLEM_REPORTED',
  'CANCELLED'
);

create type public.merchant_order_rejection_reason as enum (
  'OUT_OF_STOCK',
  'SIZE_UNAVAILABLE',
  'COLOUR_UNAVAILABLE',
  'DAMAGED_ITEM',
  'INVENTORY_MISMATCH',
  'ITEM_NOT_FOUND',
  'SHOP_BUSY',
  'SHOP_CLOSING',
  'OTHER'
);

create type public.wardrobe_item_status as enum (
  'ACTIVE',
  'DELETED'
);

create type public.saved_look_item_type as enum (
  'WARDROBE_ITEM',
  'PRODUCT_VARIANT'
);

create type public.group_room_status as enum (
  'OPEN',
  'CLOSED'
);

create type public.group_room_member_role as enum (
  'OWNER',
  'PARTICIPANT'
);

create type public.group_room_member_status as enum (
  'ACTIVE',
  'REMOVED'
);

create type public.group_room_share_type as enum (
  'PRODUCT_VARIANT',
  'SAVED_LOOK'
);

create type public.group_room_vote as enum (
  'LOVE',
  'MAYBE',
  'SKIP'
);

create domain public.money_paise as bigint
check (value >= 0);

comment on domain public.money_paise is
  'Non-negative monetary amount stored as integer paise.';

create domain public.non_negative_quantity as integer
check (value >= 0);

comment on domain public.non_negative_quantity is
  'Quantity that may be zero but must never become negative.';

create domain public.positive_quantity as integer
check (value > 0);

comment on domain public.positive_quantity is
  'Quantity that must be greater than zero.';

create domain public.rating_value as numeric(3, 2)
check (value >= 1 and value <= 5);

comment on domain public.rating_value is
  'Rating value constrained to the inclusive range from 1 to 5.';

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Sets a row updated_at column to the current timestamptz value.';
