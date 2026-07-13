-- S3-11: merchant low-stock inventory read model.
--
-- The view is security-invoker so authenticated merchant RLS on shops,
-- products, variants, and balances remains authoritative. It contains only
-- persisted balance rows where available stock is at or below reorder level.

create index inventory_balances_low_stock_read_idx
on public.inventory_balances (
  shop_id,
  (
    stock_on_hand
    - reserved_quantity
    - damaged_quantity
  ),
  reorder_level desc,
  variant_id
)
where (
  stock_on_hand
  - reserved_quantity
  - damaged_quantity
) <= reorder_level;

create view public.merchant_low_stock_inventory
with (security_invoker = true)
as
select
  balance.shop_id,
  product.id as product_id,
  product.name as product_name,
  product.slug as product_slug,
  product.brand as product_brand,
  product.is_active as product_is_active,
  variant.id as variant_id,
  variant.sku,
  variant.colour_name,
  variant.size_label,
  variant.is_active as variant_is_active,
  balance.stock_on_hand,
  balance.reserved_quantity,
  balance.damaged_quantity,
  (
    balance.stock_on_hand
    - balance.reserved_quantity
    - balance.damaged_quantity
  )::integer as available_quantity,
  balance.reorder_level,
  balance.version,
  balance.last_counted_at,
  balance.updated_at,
  case
    when (
      balance.stock_on_hand
      - balance.reserved_quantity
      - balance.damaged_quantity
    ) = 0
      then 'OUT_OF_STOCK'
    else 'LOW_STOCK'
  end as inventory_state
from public.inventory_balances balance
join public.product_variants variant
  on variant.id = balance.variant_id
  and variant.shop_id = balance.shop_id
join public.products product
  on product.id = variant.product_id
  and product.shop_id = balance.shop_id
where product.deleted_at is null
  and (
    balance.stock_on_hand
    - balance.reserved_quantity
    - balance.damaged_quantity
  ) <= balance.reorder_level;

comment on view public.merchant_low_stock_inventory is
  'RLS-aware merchant read model for persisted low-stock and out-of-stock variants.';

revoke all privileges
on table public.merchant_low_stock_inventory
from public, anon, authenticated;

grant select
on table public.merchant_low_stock_inventory
to authenticated;
