create unique index if not exists merchant_settlement_items_one_order_credit_idx
  on public.merchant_settlement_items(order_id)
  where entry_type = 'ORDER_CREDIT' and order_id is not null;

create unique index if not exists merchant_settlement_items_one_refund_idx
  on public.merchant_settlement_items(refund_id)
  where entry_type = 'REFUND' and refund_id is not null;

create table if not exists private.finance_command_receipts (
  actor_id uuid not null references public.profiles(id),
  action text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  resource_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_id, action, idempotency_key),
  constraint finance_command_action_nonempty check (length(btrim(action)) > 0),
  constraint finance_command_fingerprint_format check (
    request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint finance_command_completion_shape check (
    (resource_id is null and completed_at is null)
    or (resource_id is not null and completed_at is not null and completed_at >= created_at)
  )
);

revoke all on private.finance_command_receipts from public, anon, authenticated;
grant select, insert, update on private.finance_command_receipts to service_role;

create or replace function private.merchant_settlement_eligible_orders(
  p_shop_id uuid,
  p_period_start date,
  p_period_end date
) returns table (
  order_id uuid,
  order_number text,
  delivered_at timestamptz,
  merchant_credit_paise bigint,
  payment_status public.order_payment_status
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    o.id,
    o.order_number,
    o.delivered_at,
    o.subtotal_paise - o.product_discount_paise - o.coupon_discount_paise,
    o.payment_status
  from public.orders o
  where o.shop_id = p_shop_id
    and o.status in ('DELIVERED','COMPLETED')
    and o.delivered_at is not null
    and o.delivered_at::date between p_period_start and p_period_end
    and o.delivered_at + interval '7 days' <= statement_timestamp()
    and o.payment_status in (
      'CAPTURED','PARTIALLY_REFUNDED','REFUNDED','COD_COLLECTED'
    )
    and not exists (
      select 1 from public.return_requests r
      where r.order_id = o.id
        and r.status not in ('REJECTED','REFUNDED','CLOSED')
    )
    and not exists (
      select 1 from public.support_tickets s
      where s.order_id = o.id and s.status not in ('RESOLVED','CLOSED')
    )
    and not exists (
      select 1 from public.merchant_settlement_items i
      where i.order_id = o.id and i.entry_type = 'ORDER_CREDIT'
    )
  order by o.id
$$;

revoke all on function private.merchant_settlement_eligible_orders(uuid,date,date)
  from public, anon, authenticated;
grant execute on function private.merchant_settlement_eligible_orders(uuid,date,date)
  to service_role;

create or replace function public.get_merchant_settlement_eligibility(
  p_shop_id uuid,
  p_period_start date,
  p_period_end date
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with bank as (
    select b.id
    from public.shop_bank_accounts b
    where b.shop_id = p_shop_id and b.is_primary
      and b.verification_status = 'VERIFIED'
    limit 1
  ), eligible as (
    select * from private.merchant_settlement_eligible_orders(
      p_shop_id, p_period_start, p_period_end
    )
  ), refunds as (
    select coalesce(sum(r.amount_paise), 0)::bigint as amount
    from public.refunds r
    join eligible e on e.order_id = r.order_id
    where r.status = 'COMPLETED'
      and not exists (
        select 1 from public.merchant_settlement_items i
        where i.refund_id = r.id and i.entry_type = 'REFUND'
      )
  ), totals as (
    select count(*)::integer as order_count,
      coalesce(sum(merchant_credit_paise), 0)::bigint as gross
    from eligible
  )
  select jsonb_build_object(
    'shopId', p_shop_id,
    'periodStart', p_period_start,
    'periodEnd', p_period_end,
    'bankAccountVerified', exists(select 1 from bank),
    'eligible', exists(select 1 from bank) and totals.order_count > 0,
    'eligibleOrderCount', totals.order_count,
    'grossSalesPaise', totals.gross,
    'commissionBps', 1000,
    'commissionPaise', round(totals.gross::numeric * 1000 / 10000)::bigint,
    'refundDeductionPaise', refunds.amount,
    'netPayablePaise', totals.gross
      - round(totals.gross::numeric * 1000 / 10000)::bigint
      - refunds.amount,
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'orderId', e.order_id,
        'orderNumber', e.order_number,
        'deliveredAt', e.delivered_at,
        'merchantCreditPaise', e.merchant_credit_paise,
        'paymentStatus', e.payment_status
      ) order by e.order_id)
      from eligible e
    ), '[]'::jsonb)
  )
  from totals cross join refunds
$$;

create or replace function private.build_merchant_settlement_detail(
  p_settlement_id uuid,
  p_replayed boolean
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'settlementId', s.id,
    'settlementNumber', s.settlement_number,
    'shopId', s.shop_id,
    'bankAccountId', s.bank_account_id,
    'periodStart', s.period_start,
    'periodEnd', s.period_end,
    'grossSalesPaise', s.gross_sales_paise,
    'commissionPaise', s.commission_paise,
    'discountSharePaise', s.discount_share_paise,
    'refundDeductionPaise', s.refund_deduction_paise,
    'taxPaise', s.tax_paise,
    'adjustmentPaise', s.adjustment_paise,
    'netPayablePaise', s.net_payable_paise,
    'status', s.status,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entryId', i.id,
        'orderId', i.order_id,
        'refundId', i.refund_id,
        'entryType', i.entry_type,
        'amountPaise', i.amount_paise,
        'description', i.description,
        'createdAt', i.created_at
      ) order by i.created_at, i.id)
      from public.merchant_settlement_items i where i.settlement_id = s.id
    ), '[]'::jsonb),
    'replayed', p_replayed
  )
  from public.merchant_settlements s where s.id = p_settlement_id
$$;

create or replace function public.get_merchant_settlement_detail(
  p_settlement_id uuid
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select private.build_merchant_settlement_detail(p_settlement_id, true)
$$;

create or replace function public.create_merchant_settlement_ledger(
  p_actor_id uuid,
  p_shop_id uuid,
  p_period_start date,
  p_period_end date,
  p_reason_code text,
  p_note text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt private.finance_command_receipts;
  v_bank public.shop_bank_accounts;
  v_settlement public.merchant_settlements;
  v_order record;
  v_refund public.refunds;
  v_fingerprint text;
  v_gross bigint := 0;
  v_commission bigint := 0;
  v_refunds bigint := 0;
  v_count integer := 0;
  v_settlement_id uuid := gen_random_uuid();
  v_audit_id uuid;
begin
  if p_actor_id is null or p_shop_id is null or p_idempotency_key is null
    or p_period_start is null or p_period_end is null
    or p_period_end < p_period_start
    or nullif(btrim(p_reason_code), '') is null then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;
  v_fingerprint := encode(extensions.digest(concat_ws('|',
    p_shop_id::text, p_period_start::text, p_period_end::text,
    btrim(p_reason_code), coalesce(nullif(btrim(p_note), ''), '')
  ), 'sha256'), 'hex');
  insert into private.finance_command_receipts(
    actor_id, action, idempotency_key, request_fingerprint
  ) values (
    p_actor_id, 'finance.merchant_settlement.create',
    p_idempotency_key, v_fingerprint
  ) on conflict do nothing returning * into v_receipt;
  if not found then
    select * into strict v_receipt from private.finance_command_receipts
    where actor_id = p_actor_id
      and action = 'finance.merchant_settlement.create'
      and idempotency_key = p_idempotency_key for update;
    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;
    if v_receipt.resource_id is null then raise exception 'FINANCE_REQUEST_INCOMPLETE'; end if;
    return private.build_merchant_settlement_detail(v_receipt.resource_id, true);
  end if;

  perform 1 from public.shops where id = p_shop_id for update;
  if not found then raise exception 'FINANCE_SETTLEMENT_NOT_ELIGIBLE'; end if;
  select * into v_bank from public.shop_bank_accounts
  where shop_id = p_shop_id and is_primary and verification_status = 'VERIFIED'
  order by id limit 1 for update;
  if not found then raise exception 'FINANCE_SETTLEMENT_NOT_ELIGIBLE'; end if;
  if exists (
    select 1 from public.merchant_settlements
    where shop_id = p_shop_id and period_start = p_period_start
      and period_end = p_period_end
  ) then raise exception 'FINANCE_SETTLEMENT_EXISTS'; end if;

  for v_order in
    select e.*
    from private.merchant_settlement_eligible_orders(
      p_shop_id, p_period_start, p_period_end
    ) e
    join public.orders locked_order on locked_order.id = e.order_id
    order by locked_order.id
    for update of locked_order
  loop
    v_count := v_count + 1;
    v_gross := v_gross + v_order.merchant_credit_paise;
  end loop;
  if v_count = 0 then raise exception 'FINANCE_SETTLEMENT_NOT_ELIGIBLE'; end if;
  v_commission := round(v_gross::numeric * 1000 / 10000)::bigint;
  select coalesce(sum(r.amount_paise), 0)::bigint into v_refunds
  from public.refunds r
  join private.merchant_settlement_eligible_orders(
    p_shop_id, p_period_start, p_period_end
  ) e on e.order_id = r.order_id
  where r.status = 'COMPLETED'
    and not exists (
      select 1 from public.merchant_settlement_items i
      where i.refund_id = r.id and i.entry_type = 'REFUND'
    );

  insert into public.merchant_settlements(
    id, settlement_number, shop_id, bank_account_id,
    period_start, period_end, gross_sales_paise, commission_paise,
    discount_share_paise, refund_deduction_paise, tax_paise,
    adjustment_paise, net_payable_paise, status
  ) values (
    v_settlement_id,
    'SET-' || upper(replace(v_settlement_id::text, '-', '')),
    p_shop_id, v_bank.id, p_period_start, p_period_end,
    v_gross, v_commission, 0, v_refunds, 0, 0,
    v_gross - v_commission - v_refunds, 'REVIEW'
  ) returning * into v_settlement;

  for v_order in
    select * from private.merchant_settlement_eligible_orders(
      p_shop_id, p_period_start, p_period_end
    )
  loop
    insert into public.merchant_settlement_items(
      settlement_id, order_id, entry_type, amount_paise, description
    ) values (
      v_settlement.id, v_order.order_id, 'ORDER_CREDIT',
      v_order.merchant_credit_paise, 'Eligible delivered order credit'
    );
    insert into public.merchant_settlement_items(
      settlement_id, order_id, entry_type, amount_paise, description
    ) values (
      v_settlement.id, v_order.order_id, 'COMMISSION',
      -round(v_order.merchant_credit_paise::numeric * 1000 / 10000)::bigint,
      'Vastra MVP commission at 10%'
    );
  end loop;
  for v_refund in
    select r.* from public.refunds r
    join public.merchant_settlement_items credit
      on credit.order_id = r.order_id
      and credit.settlement_id = v_settlement.id
      and credit.entry_type = 'ORDER_CREDIT'
    where r.status = 'COMPLETED'
      and not exists (
        select 1 from public.merchant_settlement_items used
        where used.refund_id = r.id and used.entry_type = 'REFUND'
      )
    order by r.id for update of r
  loop
    insert into public.merchant_settlement_items(
      settlement_id, refund_id, entry_type, amount_paise, description
    ) values (
      v_settlement.id, v_refund.id, 'REFUND',
      -v_refund.amount_paise, 'Completed customer refund deduction'
    );
  end loop;

  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    idempotency_key, before_state, after_state
  ) values (
    p_actor_id, 'finance.merchant_settlement.create',
    'MERCHANT_SETTLEMENT', v_settlement.id, btrim(p_reason_code),
    nullif(btrim(p_note), ''), p_idempotency_key, null,
    jsonb_build_object(
      'shopId', p_shop_id, 'periodStart', p_period_start,
      'periodEnd', p_period_end, 'grossSalesPaise', v_gross,
      'commissionPaise', v_commission,
      'refundDeductionPaise', v_refunds,
      'netPayablePaise', v_settlement.net_payable_paise,
      'status', v_settlement.status
    )
  ) returning id into v_audit_id;
  update private.finance_command_receipts
  set resource_id = v_settlement.id, completed_at = transaction_timestamp()
  where actor_id = p_actor_id
    and action = 'finance.merchant_settlement.create'
    and idempotency_key = p_idempotency_key;
  perform private.enqueue_outbox_event(
    'merchant.settlement.review_ready', 'MERCHANT_SETTLEMENT', v_settlement.id,
    jsonb_build_object(
      'settlementId', v_settlement.id, 'shopId', p_shop_id,
      'netPayablePaise', v_settlement.net_payable_paise,
      'auditId', v_audit_id
    ), transaction_timestamp(), transaction_timestamp()
  );
  return private.build_merchant_settlement_detail(v_settlement.id, false);
end;
$$;

revoke all on function public.get_merchant_settlement_eligibility(uuid,date,date)
  from public, anon, authenticated;
revoke all on function public.get_merchant_settlement_detail(uuid)
  from public, anon, authenticated;
revoke all on function public.create_merchant_settlement_ledger(uuid,uuid,date,date,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.get_merchant_settlement_eligibility(uuid,date,date)
  to service_role;
grant execute on function public.get_merchant_settlement_detail(uuid)
  to service_role;
grant execute on function public.create_merchant_settlement_ledger(uuid,uuid,date,date,text,text,uuid)
  to service_role;
