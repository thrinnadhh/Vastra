-- S5-06: merchant packing checklist and durable item verification.
--
-- These backend-only RPCs validate merchant ownership inside each transaction.
-- Packing completion is deliberately not a READY_FOR_PICKUP transition.

create or replace function public.start_merchant_order_packing(
  p_actor uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  replayed boolean := false;
begin
  if p_actor is null or p_order_id is null then
    raise exception 'merchant actor and order are required'
      using errcode = '22023';
  end if;

  select placed_order.*
  into order_row
  from public.orders placed_order
  join public.shops shop
    on shop.id = placed_order.shop_id
  where placed_order.id = p_order_id
    and shop.merchant_id = p_actor
    and shop.deleted_at is null
  for update of placed_order;

  if not found then
    raise exception 'merchant order not found'
      using errcode = 'P0021';
  end if;

  if order_row.status = 'PACKING' then
    replayed := true;
  elsif order_row.status <> 'MERCHANT_ACCEPTED' then
    raise exception 'merchant order state invalid for packing'
      using errcode = 'P0022';
  end if;

  if not replayed then
    select *
    into strict order_row
    from private.transition_order_state(
      order_row.id,
      'PACKING',
      p_actor,
      'MERCHANT',
      null,
      'Merchant started packing the order'
    );

    perform private.enqueue_outbox_event(
      'order.merchant.packing.started',
      'ORDER',
      order_row.id,
      jsonb_build_object(
        'orderId', order_row.id,
        'shopId', order_row.shop_id,
        'merchantId', p_actor,
        'status', order_row.status
      ),
      statement_timestamp(),
      statement_timestamp()
    );
  end if;

  return jsonb_build_object(
    'orderId', order_row.id,
    'orderNumber', order_row.order_number,
    'status', order_row.status,
    'replayed', replayed
  );
end;
$$;

comment on function public.start_merchant_order_packing(uuid, uuid) is
  'Idempotently transitions one owned MERCHANT_ACCEPTED order to PACKING.';

create or replace function public.get_merchant_order_packing_list(
  p_actor uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  item_rows jsonb;
  total_lines integer;
  verified_lines integer;
begin
  if p_actor is null or p_order_id is null then
    raise exception 'merchant actor and order are required'
      using errcode = '22023';
  end if;

  select placed_order.*
  into order_row
  from public.orders placed_order
  join public.shops shop
    on shop.id = placed_order.shop_id
  where placed_order.id = p_order_id
    and shop.merchant_id = p_actor
    and shop.deleted_at is null;

  if not found then
    raise exception 'merchant order not found'
      using errcode = 'P0021';
  end if;

  if order_row.status not in ('MERCHANT_ACCEPTED', 'PACKING') then
    raise exception 'merchant order state invalid for packing list'
      using errcode = 'P0022';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'orderItemId', order_item.id,
          'productName', order_item.product_name_snapshot,
          'sku', order_item.sku_snapshot,
          'colour', order_item.colour_snapshot,
          'size', order_item.size_snapshot,
          'imageObjectKey', order_item.image_object_key_snapshot,
          'quantity', order_item.quantity,
          'fulfilmentStatus', order_item.fulfilment_status,
          'verification', case
            when latest_verification.id is null then null
            else jsonb_build_object(
              'method', latest_verification.verification_method,
              'result', latest_verification.result,
              'scannedBarcode', latest_verification.scanned_barcode,
              'verifiedAt', latest_verification.verified_at
            )
          end
        )
        order by order_item.created_at, order_item.id
      ),
      '[]'::jsonb
    ),
    count(*)::integer,
    count(*) filter (
      where order_item.fulfilment_status = 'VERIFIED'
        and successful_verification.id is not null
    )::integer
  into item_rows, total_lines, verified_lines
  from public.order_items order_item
  left join lateral (
    select verification.*
    from public.order_item_verifications verification
    where verification.order_item_id = order_item.id
    order by verification.verified_at desc, verification.id desc
    limit 1
  ) latest_verification on true
  left join lateral (
    select verification.id
    from public.order_item_verifications verification
    where verification.order_item_id = order_item.id
      and verification.result in ('MATCH', 'OVERRIDDEN')
    limit 1
  ) successful_verification on true
  where order_item.order_id = order_row.id;

  if total_lines = 0 then
    raise exception 'merchant packing list has no order items'
      using errcode = '55000';
  end if;

  return jsonb_build_object(
    'orderId', order_row.id,
    'orderNumber', order_row.order_number,
    'status', order_row.status,
    'totalLines', total_lines,
    'verifiedLines', verified_lines,
    'allVerified', verified_lines = total_lines,
    'items', item_rows
  );
end;
$$;

comment on function public.get_merchant_order_packing_list(uuid, uuid) is
  'Returns an owned accepted or packing order checklist from immutable item snapshots.';

create or replace function public.verify_merchant_order_item(
  p_actor uuid,
  p_order_id uuid,
  p_order_item_id uuid,
  p_method text,
  p_barcode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  item_row public.order_items;
  verification_row public.order_item_verifications;
  resolved_variant_id uuid;
  expected_result public.order_item_verification_result;
  replayed boolean := false;
  total_lines integer;
  verified_lines integer;
begin
  if p_actor is null or p_order_id is null or p_order_item_id is null then
    raise exception 'merchant actor, order, and order item are required'
      using errcode = '22023';
  end if;

  if p_method not in ('BARCODE', 'MANUAL') then
    raise exception 'unsupported verification method'
      using errcode = '22023';
  end if;

  if p_method = 'BARCODE' and (
    p_barcode is null
    or p_barcode <> btrim(p_barcode)
    or length(p_barcode) = 0
    or length(p_barcode) > 255
    or p_barcode ~ '[[:cntrl:]]'
  ) then
    raise exception 'invalid barcode'
      using errcode = '22023';
  end if;

  if p_method = 'MANUAL' and p_barcode is not null then
    raise exception 'manual verification cannot include a barcode'
      using errcode = '22023';
  end if;

  select placed_order.*
  into order_row
  from public.orders placed_order
  join public.shops shop
    on shop.id = placed_order.shop_id
  where placed_order.id = p_order_id
    and shop.merchant_id = p_actor
    and shop.deleted_at is null
  for update of placed_order;

  if not found then
    raise exception 'merchant order not found'
      using errcode = 'P0021';
  end if;

  if order_row.status <> 'PACKING' then
    raise exception 'merchant order is not packing'
      using errcode = 'P0022';
  end if;

  select *
  into item_row
  from public.order_items order_item
  where order_item.id = p_order_item_id
    and order_item.order_id = order_row.id
    and order_item.shop_id = order_row.shop_id
  for update;

  if not found then
    raise exception 'merchant order item not found'
      using errcode = 'P0021';
  end if;

  select *
  into verification_row
  from public.order_item_verifications verification
  where verification.order_item_id = item_row.id
    and verification.result in ('MATCH', 'OVERRIDDEN')
  order by verification.verified_at, verification.id
  limit 1
  for update;

  if found then
    if (
      p_method = 'MANUAL'
      and verification_row.verification_method = 'MANUAL'
      and verification_row.result = 'MATCH'
      and verification_row.verified_variant_id = item_row.variant_id
    ) or (
      p_method = 'BARCODE'
      and verification_row.verification_method = 'BARCODE'
      and verification_row.result = 'MATCH'
      and verification_row.scanned_barcode = p_barcode
      and verification_row.verified_variant_id = item_row.variant_id
    ) then
      replayed := true;
    else
      raise exception 'successful verification command conflicts with stored evidence'
        using errcode = 'P0023';
    end if;
  end if;

  if not replayed then
    if p_method = 'MANUAL' then
      resolved_variant_id := item_row.variant_id;
      expected_result := 'MATCH';
    else
      select barcode.variant_id
      into resolved_variant_id
      from public.variant_barcodes barcode
      where barcode.barcode_value = p_barcode;

      expected_result := case
        when resolved_variant_id = item_row.variant_id then 'MATCH'
        else 'MISMATCH'
      end;
    end if;

    if expected_result = 'MISMATCH' then
      select *
      into verification_row
      from public.order_item_verifications verification
      where verification.order_item_id = item_row.id
        and verification.verification_method = 'BARCODE'
        and verification.scanned_barcode = p_barcode
        and verification.result = 'MISMATCH'
        and verification.verified_variant_id is not distinct from resolved_variant_id
      order by verification.verified_at, verification.id
      limit 1
      for update;

      if found then
        replayed := true;
      end if;
    end if;
  end if;

  if not replayed then
    insert into public.order_item_verifications (
      order_item_id,
      verification_method,
      scanned_barcode,
      verified_variant_id,
      result,
      verified_by
    )
    values (
      item_row.id,
      p_method::public.order_item_verification_method,
      case when p_method = 'BARCODE' then p_barcode else null end,
      resolved_variant_id,
      expected_result,
      p_actor
    )
    returning * into strict verification_row;

    if expected_result = 'MATCH' then
      update public.order_items
      set fulfilment_status = 'VERIFIED'
      where id = item_row.id
      returning * into strict item_row;

      perform private.enqueue_outbox_event(
        'order.item.verified',
        'ORDER',
        order_row.id,
        jsonb_build_object(
          'orderId', order_row.id,
          'orderItemId', item_row.id,
          'shopId', order_row.shop_id,
          'merchantId', p_actor,
          'method', verification_row.verification_method,
          'result', verification_row.result,
          'verifiedAt', verification_row.verified_at
        ),
        verification_row.verified_at,
        verification_row.verified_at
      );
    else
      perform private.enqueue_outbox_event(
        'order.item.verification_mismatch',
        'ORDER',
        order_row.id,
        jsonb_build_object(
          'orderId', order_row.id,
          'orderItemId', item_row.id,
          'shopId', order_row.shop_id,
          'merchantId', p_actor,
          'scannedBarcode', p_barcode,
          'resolvedVariantId', resolved_variant_id,
          'result', verification_row.result,
          'verifiedAt', verification_row.verified_at
        ),
        verification_row.verified_at,
        verification_row.verified_at
      );
    end if;
  end if;

  select *
  into strict item_row
  from public.order_items order_item
  where order_item.id = item_row.id;

  select
    count(*)::integer,
    count(*) filter (
      where order_item.fulfilment_status = 'VERIFIED'
        and exists (
          select 1
          from public.order_item_verifications successful
          where successful.order_item_id = order_item.id
            and successful.result in ('MATCH', 'OVERRIDDEN')
        )
    )::integer
  into total_lines, verified_lines
  from public.order_items order_item
  where order_item.order_id = order_row.id;

  return jsonb_build_object(
    'orderId', order_row.id,
    'orderItemId', item_row.id,
    'fulfilmentStatus', item_row.fulfilment_status,
    'method', verification_row.verification_method,
    'result', verification_row.result,
    'scannedBarcode', verification_row.scanned_barcode,
    'verified', verification_row.result = 'MATCH',
    'verifiedAt', verification_row.verified_at,
    'totalLines', total_lines,
    'verifiedLines', verified_lines,
    'allVerified', verified_lines = total_lines,
    'replayed', replayed
  );
end;
$$;

comment on function public.verify_merchant_order_item(uuid, uuid, uuid, text, text) is
  'Durably records idempotent barcode or manual packing verification for one owned order line.';

revoke all
on function public.start_merchant_order_packing(uuid, uuid)
from public, anon, authenticated;

revoke all
on function public.get_merchant_order_packing_list(uuid, uuid)
from public, anon, authenticated;

revoke all
on function public.verify_merchant_order_item(uuid, uuid, uuid, text, text)
from public, anon, authenticated;

grant execute
on function public.start_merchant_order_packing(uuid, uuid)
to service_role;

grant execute
on function public.get_merchant_order_packing_list(uuid, uuid)
to service_role;

grant execute
on function public.verify_merchant_order_item(uuid, uuid, uuid, text, text)
to service_role;
