-- S3-09: idempotent multi-item merchant offline sales.
--
-- The RPC owns the full transaction. It validates the owned shop and active
-- variants, stores the completed sale and immutable line snapshots, deducts
-- each line in stable variant order, writes one inventory movement per line,
-- and enqueues availability and sale events before committing.

create table public.offline_sales (
  id uuid primary key,
  sale_number text not null,
  idempotency_key uuid not null,
  shop_id uuid not null,
  merchant_id uuid not null,
  customer_phone text,
  subtotal_paise public.money_paise not null,
  discount_paise public.money_paise not null default 0,
  tax_paise public.money_paise not null default 0,
  total_paise public.money_paise not null,
  payment_method text not null,
  status text not null default 'COMPLETED',
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,

  constraint offline_sales_sale_number_key unique (sale_number),
  constraint offline_sales_idempotency_key unique (idempotency_key),

  constraint offline_sales_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint offline_sales_merchant_id_fkey
    foreign key (merchant_id)
    references public.merchant_profiles (user_id)
    on update cascade
    on delete restrict,

  constraint offline_sales_recorded_by_fkey
    foreign key (recorded_by)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint offline_sales_phone_nonempty
    check (
      customer_phone is null
      or length(btrim(customer_phone)) between 1 and 32
    ),

  constraint offline_sales_discount_within_subtotal
    check (discount_paise <= subtotal_paise),

  constraint offline_sales_total_arithmetic
    check (
      total_paise = subtotal_paise - discount_paise + tax_paise
    ),

  constraint offline_sales_payment_method_check
    check (payment_method in ('CASH', 'UPI', 'CARD', 'OTHER')),

  constraint offline_sales_status_check
    check (status in ('COMPLETED', 'VOIDED', 'REFUNDED')),

  constraint offline_sales_lifecycle_check
    check (
      (
        status = 'COMPLETED'
        and voided_at is null
      )
      or (
        status in ('VOIDED', 'REFUNDED')
        and voided_at is not null
        and voided_at >= created_at
      )
    )
);

comment on table public.offline_sales is
  'Completed physical shop sales recorded atomically with inventory deduction.';

create table public.offline_sale_items (
  id uuid primary key,
  offline_sale_id uuid not null,
  shop_id uuid not null,
  variant_id uuid not null,
  quantity public.positive_quantity not null,
  unit_price_paise public.money_paise not null,
  discount_paise public.money_paise not null default 0,
  total_paise public.money_paise not null,
  identification_method text not null,
  movement_id bigint not null,
  created_at timestamptz not null default now(),

  constraint offline_sale_items_sale_id_fkey
    foreign key (offline_sale_id)
    references public.offline_sales (id)
    on update cascade
    on delete restrict,

  constraint offline_sale_items_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint offline_sale_items_variant_shop_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint offline_sale_items_movement_id_fkey
    foreign key (movement_id)
    references public.inventory_movements (id)
    on update cascade
    on delete restrict,

  constraint offline_sale_items_sale_variant_key
    unique (offline_sale_id, variant_id),

  constraint offline_sale_items_movement_key unique (movement_id),

  constraint offline_sale_items_discount_within_gross
    check (
      discount_paise <= quantity::bigint * unit_price_paise
    ),

  constraint offline_sale_items_total_arithmetic
    check (
      total_paise = quantity::bigint * unit_price_paise - discount_paise
    ),

  constraint offline_sale_items_identification_method_check
    check (identification_method in ('BARCODE', 'MANUAL_SEARCH'))
);

comment on table public.offline_sale_items is
  'Immutable item and price snapshots for a completed physical shop sale.';

create table private.offline_sale_requests (
  idempotency_key uuid primary key,
  shop_id uuid not null,
  actor_id uuid not null,
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint offline_sale_requests_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint offline_sale_requests_actor_id_fkey
    foreign key (actor_id)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint offline_sale_requests_request_object
    check (jsonb_typeof(request_payload) = 'object'),

  constraint offline_sale_requests_result_object
    check (
      result_payload is null
      or jsonb_typeof(result_payload) = 'object'
    ),

  constraint offline_sale_requests_completion_shape
    check (
      (
        result_payload is null
        and completed_at is null
      )
      or (
        result_payload is not null
        and completed_at is not null
        and completed_at >= created_at
      )
    )
);

comment on table private.offline_sale_requests is
  'Backend-only idempotency receipts for merchant offline sale creation.';

create unique index inventory_movements_offline_sale_variant_idx
on public.inventory_movements (reference_id, variant_id)
where reference_type = 'OFFLINE_SALE'
  and reference_id is not null;

create index offline_sales_shop_created_idx
on public.offline_sales (shop_id, created_at desc, id desc);

create index offline_sale_items_sale_idx
on public.offline_sale_items (offline_sale_id, created_at, id);

alter table public.offline_sales enable row level security;
alter table public.offline_sales force row level security;

alter table public.offline_sale_items enable row level security;
alter table public.offline_sale_items force row level security;

revoke all privileges
on table
  public.offline_sales,
  public.offline_sale_items,
  private.offline_sale_requests
from public, anon, authenticated;

grant select
on table
  public.offline_sales,
  public.offline_sale_items
to authenticated;

create policy offline_sales_authorized_read
on public.offline_sales
for select
to authenticated
using (
  authz.owns_shop(shop_id)
  or authz.is_admin()
);

create policy offline_sale_items_authorized_read
on public.offline_sale_items
for select
to authenticated
using (
  exists (
    select 1
    from public.offline_sales sale
    where sale.id = offline_sale_id
      and (
        authz.owns_shop(sale.shop_id)
        or authz.is_admin()
      )
  )
);

create or replace function public.create_merchant_offline_sale(
  p_shop_id uuid,
  p_customer_phone text,
  p_tax_paise bigint,
  p_payment_method text,
  p_items jsonb,
  p_idempotency_key uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_shop public.shops;
  request_row private.offline_sale_requests;
  sale_row public.offline_sales;
  balance_after public.inventory_balances;
  movement_row public.inventory_movements;
  item_payload jsonb;
  normalized_items jsonb := '[]'::jsonb;
  canonical_items jsonb;
  result_items jsonb := '[]'::jsonb;
  canonical_request_payload jsonb;
  final_result jsonb;
  normalized_phone text;
  item_variant_id uuid;
  item_quantity integer;
  item_unit_price bigint;
  item_discount bigint;
  item_total bigint;
  item_method text;
  item_id uuid;
  sale_id uuid := extensions.gen_random_uuid();
  sale_number text;
  subtotal_paise bigint;
  discount_paise bigint;
  total_paise bigint;
begin
  if p_shop_id is null
    or p_actor is null
    or p_idempotency_key is null
  then
    raise exception
      'shop, actor, and idempotency key are required'
      using errcode = '22023';
  end if;

  select *
  into owned_shop
  from public.shops shop
  where shop.id = p_shop_id
    and shop.merchant_id = p_actor;

  if not found then
    raise exception
      'shop % does not belong to merchant %',
      p_shop_id,
      p_actor
      using errcode = '23503';
  end if;

  if p_payment_method not in ('CASH', 'UPI', 'CARD', 'OTHER') then
    raise exception
      'unsupported offline sale payment method'
      using errcode = '22023';
  end if;

  if p_tax_paise is null or p_tax_paise < 0 then
    raise exception
      'offline sale tax must be non-negative'
      using errcode = '22023';
  end if;

  normalized_phone := nullif(btrim(p_customer_phone), '');

  if p_customer_phone is not null
    and (
      normalized_phone is null
      or length(normalized_phone) > 32
    )
  then
    raise exception
      'offline sale customer phone is invalid'
      using errcode = '22023';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 50
  then
    raise exception
      'offline sale requires between 1 and 50 items'
      using errcode = '22023';
  end if;

  for item_payload in
    select value
    from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item_payload) <> 'object' then
      raise exception
        'offline sale item must be an object'
        using errcode = '22023';
    end if;

    item_variant_id := (item_payload ->> 'variantId')::uuid;
    item_quantity := (item_payload ->> 'quantity')::integer;
    item_unit_price := (item_payload ->> 'unitPricePaise')::bigint;
    item_discount := coalesce(
      (item_payload ->> 'discountPaise')::bigint,
      0
    );
    item_method := item_payload ->> 'identificationMethod';

    if item_quantity <= 0
      or item_unit_price < 0
      or item_discount < 0
      or item_method not in ('BARCODE', 'MANUAL_SEARCH')
    then
      raise exception
        'offline sale item is invalid'
        using errcode = '22023';
    end if;

    item_total :=
      item_quantity::bigint * item_unit_price - item_discount;

    if item_total < 0 then
      raise exception
        'offline sale item discount exceeds gross'
        using errcode = '22023';
    end if;

    normalized_items := normalized_items || jsonb_build_array(
      jsonb_build_object(
        'variantId', item_variant_id,
        'quantity', item_quantity,
        'unitPricePaise', item_unit_price,
        'discountPaise', item_discount,
        'identificationMethod', item_method
      )
    );
  end loop;

  if (
    select count(*)
    from jsonb_array_elements(normalized_items)
  ) <> (
    select count(distinct value ->> 'variantId')
    from jsonb_array_elements(normalized_items)
  ) then
    raise exception
      'offline sale cannot contain duplicate variants'
      using errcode = '22023';
  end if;

  select jsonb_agg(value order by value ->> 'variantId')
  into canonical_items
  from jsonb_array_elements(normalized_items);

  select
    sum(
      (value ->> 'quantity')::bigint
      * (value ->> 'unitPricePaise')::bigint
    ),
    sum((value ->> 'discountPaise')::bigint)
  into
    subtotal_paise,
    discount_paise
  from jsonb_array_elements(canonical_items);

  total_paise := subtotal_paise - discount_paise + p_tax_paise;

  if discount_paise > subtotal_paise or total_paise < 0 then
    raise exception
      'offline sale totals are invalid'
      using errcode = '22023';
  end if;

  canonical_request_payload := jsonb_build_object(
    'shopId', p_shop_id,
    'customerPhone', normalized_phone,
    'taxPaise', p_tax_paise,
    'paymentMethod', p_payment_method,
    'items', canonical_items,
    'actorId', p_actor
  );

  insert into private.offline_sale_requests (
    idempotency_key,
    shop_id,
    actor_id,
    request_payload
  )
  values (
    p_idempotency_key,
    p_shop_id,
    p_actor,
    canonical_request_payload
  )
  on conflict (idempotency_key) do nothing
  returning * into request_row;

  if not found then
    select *
    into strict request_row
    from private.offline_sale_requests request
    where request.idempotency_key = p_idempotency_key
    for update;

    if request_row.request_payload <> canonical_request_payload then
      raise exception
        'idempotency key reused with a different offline sale'
        using errcode = 'P0002';
    end if;

    if request_row.result_payload is null then
      raise exception
        'offline sale idempotency receipt is incomplete'
        using errcode = '55000';
    end if;

    return jsonb_set(
      request_row.result_payload,
      '{replayed}',
      to_jsonb(true),
      true
    );
  end if;

  sale_number :=
    'OS-' || upper(replace(sale_id::text, '-', ''));

  insert into public.offline_sales (
    id,
    sale_number,
    idempotency_key,
    shop_id,
    merchant_id,
    customer_phone,
    subtotal_paise,
    discount_paise,
    tax_paise,
    total_paise,
    payment_method,
    status,
    recorded_by
  )
  values (
    sale_id,
    sale_number,
    p_idempotency_key,
    p_shop_id,
    p_actor,
    normalized_phone,
    subtotal_paise,
    discount_paise,
    p_tax_paise,
    total_paise,
    p_payment_method,
    'COMPLETED',
    p_actor
  )
  returning * into sale_row;

  for item_payload in
    select value
    from jsonb_array_elements(canonical_items)
    order by value ->> 'variantId'
  loop
    item_variant_id := (item_payload ->> 'variantId')::uuid;
    item_quantity := (item_payload ->> 'quantity')::integer;
    item_unit_price := (item_payload ->> 'unitPricePaise')::bigint;
    item_discount := (item_payload ->> 'discountPaise')::bigint;
    item_method := item_payload ->> 'identificationMethod';
    item_total :=
      item_quantity::bigint * item_unit_price - item_discount;

    perform 1
    from public.product_variants variant
    where variant.id = item_variant_id
      and variant.shop_id = p_shop_id
      and variant.is_active;

    if not found then
      raise exception
        'active variant % does not belong to shop %',
        item_variant_id,
        p_shop_id
        using errcode = '23503';
    end if;

    select *
    into strict balance_after
    from private.apply_inventory_delta(
      p_shop_id,
      item_variant_id,
      -item_quantity,
      0,
      0,
      'OFFLINE_SALE',
      item_method::public.inventory_source_method,
      'OFFLINE_SALE',
      sale_id,
      'Offline sale ' || sale_number,
      p_actor
    );

    select *
    into strict movement_row
    from public.inventory_movements movement
    where movement.reference_type = 'OFFLINE_SALE'
      and movement.reference_id = sale_id
      and movement.variant_id = item_variant_id;

    item_id := extensions.gen_random_uuid();

    insert into public.offline_sale_items (
      id,
      offline_sale_id,
      shop_id,
      variant_id,
      quantity,
      unit_price_paise,
      discount_paise,
      total_paise,
      identification_method,
      movement_id
    )
    values (
      item_id,
      sale_id,
      p_shop_id,
      item_variant_id,
      item_quantity,
      item_unit_price,
      item_discount,
      item_total,
      item_method,
      movement_row.id
    );

    result_items := result_items || jsonb_build_array(
      jsonb_build_object(
        'id', item_id,
        'variantId', item_variant_id,
        'quantity', item_quantity,
        'unitPricePaise', item_unit_price,
        'discountPaise', item_discount,
        'totalPaise', item_total,
        'identificationMethod', item_method,
        'movementId', movement_row.id::text,
        'balance', jsonb_build_object(
          'persisted', true,
          'stockOnHand', balance_after.stock_on_hand,
          'reservedQuantity', balance_after.reserved_quantity,
          'damagedQuantity', balance_after.damaged_quantity,
          'availableQuantity',
            balance_after.stock_on_hand
            - balance_after.reserved_quantity
            - balance_after.damaged_quantity,
          'reorderLevel', balance_after.reorder_level,
          'version', balance_after.version,
          'lastCountedAt', balance_after.last_counted_at,
          'updatedAt', balance_after.updated_at
        )
      )
    );

    perform private.enqueue_outbox_event(
      'inventory.balance.changed',
      'PRODUCT_VARIANT',
      item_variant_id,
      jsonb_build_object(
        'shopId', p_shop_id,
        'variantId', item_variant_id,
        'offlineSaleId', sale_id,
        'movementId', movement_row.id::text,
        'stockOnHand', balance_after.stock_on_hand,
        'reservedQuantity', balance_after.reserved_quantity,
        'damagedQuantity', balance_after.damaged_quantity,
        'availableQuantity',
          balance_after.stock_on_hand
          - balance_after.reserved_quantity
          - balance_after.damaged_quantity,
        'version', balance_after.version
      ),
      movement_row.created_at,
      movement_row.created_at
    );
  end loop;

  perform private.enqueue_outbox_event(
    'offline.sale.created',
    'OFFLINE_SALE',
    sale_id,
    jsonb_build_object(
      'shopId', p_shop_id,
      'saleNumber', sale_number,
      'itemCount', jsonb_array_length(result_items),
      'totalPaise', total_paise,
      'paymentMethod', p_payment_method
    ),
    sale_row.created_at,
    sale_row.created_at
  );

  final_result := jsonb_build_object(
    'id', sale_row.id,
    'saleNumber', sale_row.sale_number,
    'idempotencyKey', sale_row.idempotency_key,
    'replayed', false,
    'shopId', sale_row.shop_id,
    'merchantId', sale_row.merchant_id,
    'customerPhone', sale_row.customer_phone,
    'subtotalPaise', sale_row.subtotal_paise,
    'discountPaise', sale_row.discount_paise,
    'taxPaise', sale_row.tax_paise,
    'totalPaise', sale_row.total_paise,
    'paymentMethod', sale_row.payment_method,
    'status', sale_row.status,
    'recordedBy', sale_row.recorded_by,
    'createdAt', sale_row.created_at,
    'items', result_items
  );

  update private.offline_sale_requests
  set
    result_payload = final_result,
    completed_at = now()
  where idempotency_key = p_idempotency_key;

  return final_result;
end;
$$;

comment on function public.create_merchant_offline_sale(
  uuid,
  text,
  bigint,
  text,
  jsonb,
  uuid,
  uuid
) is
  'Creates one completed physical sale and deducts every item atomically with idempotency and immutable inventory movements.';

revoke all
on function public.create_merchant_offline_sale(
  uuid,
  text,
  bigint,
  text,
  jsonb,
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.create_merchant_offline_sale(
  uuid,
  text,
  bigint,
  text,
  jsonb,
  uuid,
  uuid
)
to service_role;
