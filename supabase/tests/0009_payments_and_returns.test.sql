begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(39);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'payment_method'
  ),
  'UPI,CARD,NETBANKING,WALLET,COD,OTHER',
  'payment methods are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'payment_attempt_status'
  ),
  'CREATED,PENDING,AUTHORIZED,CAPTURED,FAILED,CANCELLED,PARTIALLY_REFUNDED,REFUNDED',
  'payment attempt statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'return_request_status'
  ),
  'REQUESTED,REVIEW,APPROVED,REJECTED,PICKUP_ASSIGNED,PICKED_UP,RECEIVED,VERIFIED,REFUND_PENDING,REFUNDED,CLOSED',
  'return statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'refund_status'
  ),
  'PENDING,APPROVAL_REQUIRED,INITIATED,PROCESSING,COMPLETED,FAILED,CANCELLED',
  'refund statuses are defined'
);

select ok(to_regclass('public.payments') is not null, 'payments exist');
select ok(to_regclass('public.payment_events') is not null, 'payment events exist');
select ok(to_regclass('public.return_requests') is not null, 'return requests exist');
select ok(to_regclass('public.return_items') is not null, 'return items exist');
select ok(to_regclass('public.return_evidence') is not null, 'return evidence exists');
select ok(to_regclass('public.return_status_history') is not null, 'return history exists');
select ok(to_regclass('public.refunds') is not null, 'refunds exist');

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'payments',
        'payment_events',
        'return_requests',
        'return_items',
        'return_evidence',
        'return_status_history',
        'refunds'
      )
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  7,
  'all payment and return tables force RLS'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('payments'),
        ('payment_events'),
        ('return_requests'),
        ('return_items'),
        ('return_evidence'),
        ('return_status_history'),
        ('refunds')
    ) as t(table_name)
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'anon table grants match the final RLS surface'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('payments'),
        ('payment_events'),
        ('return_requests'),
        ('return_items'),
        ('return_evidence'),
        ('return_status_history'),
        ('refunds')
    ) as t(table_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  7,
  'authenticated table grants match the final RLS surface'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_id_customer_id_key'
      and contype = 'u'
  ),
  'orders expose an order-customer composite key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_id_customer_shop_key'
      and contype = 'u'
  ),
  'orders expose an order-customer-shop composite key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'payments_order_customer_fkey'
  ),
  'payments must belong to the order customer'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'payments_order_idempotency_key'
      and contype = 'u'
  ),
  'payment attempts are idempotent per order'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.payments'::regclass
      and attname = 'amount_paise'
      and atttypid = 'public.money_paise'::regtype
      and not attisdropped
  ),
  'payment amounts use integer paise'
);

select ok(
  to_regclass('public.payments_provider_order_id_idx')
    is not null,
  'provider order identifiers are unique'
);

select ok(
  to_regclass('public.payments_provider_payment_id_idx')
    is not null,
  'provider payment identifiers are unique'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.payments'::regclass
      and tgname = 'set_payments_updated_at'
      and not tgisinternal
  ),
  'payments have an updated_at trigger'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'payment_events_provider_event_key'
      and contype = 'u'
  ),
  'payment provider events are idempotent'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'payment_events_payload_object'
      and contype = 'c'
  ),
  'payment event payloads are JSON objects'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.payment_events'::regclass
      and attname = 'id'
      and attidentity = 'a'
      and not attisdropped
  ),
  'payment events use identity IDs'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname =
      'return_requests_order_customer_shop_fkey'
  ),
  'returns belong to their order customer and shop'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'return_requests_order_idempotency_key'
      and contype = 'u'
  ),
  'returns are idempotent per order'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'return_items_request_item_key'
      and contype = 'u'
  ),
  'order items occur once per return request'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.return_items'::regclass
      and attname = 'quantity'
      and atttypid = 'public.positive_quantity'::regtype
      and not attisdropped
  ),
  'return quantities are positive'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'return_evidence_content_check'
      and contype = 'c'
  ),
  'return evidence contains a file or description'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.return_requests'::regclass
      and tgname = 'record_initial_return_status'
      and not tgisinternal
  ),
  'initial return status is recorded'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.return_requests'::regclass
      and tgname = 'record_return_status_change'
      and not tgisinternal
  ),
  'return status changes are recorded'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.return_status_history'::regclass
      and tgname =
        'prevent_return_status_history_mutation'
      and not tgisinternal
  ),
  'return history is append-only'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'refunds_order_idempotency_key'
      and contype = 'u'
  ),
  'refunds are idempotent per order'
);

select ok(
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.refunds'::regclass
      and attname = 'amount_paise'
      and atttypid = 'public.money_paise'::regtype
      and not attisdropped
  ),
  'refund amounts use integer paise'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'refunds_completion_lifecycle'
      and contype = 'c'
  ),
  'completed refunds require completion timestamps'
);

select ok(
  to_regclass('public.refunds_provider_refund_id_idx')
    is not null,
  'provider refund identifiers are unique'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.refunds'::regclass
      and tgname = 'set_refunds_updated_at'
      and not tgisinternal
  ),
  'refunds have an updated_at trigger'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'delivery_tasks_return_request_id_fkey'
  ),
  'reverse delivery tasks reference returns'
);

select * from finish();

rollback;
