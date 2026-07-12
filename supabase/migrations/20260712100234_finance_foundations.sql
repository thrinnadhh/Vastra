-- Vastra merchant settlements, captain earnings, captain payouts,
-- and their financial ledger rows.

create type public.merchant_settlement_status as enum (
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'FAILED',
  'ON_HOLD'
);

create type public.merchant_settlement_entry_type as enum (
  'ORDER_CREDIT',
  'COMMISSION',
  'DISCOUNT',
  'REFUND',
  'TAX',
  'PENALTY',
  'MANUAL_ADJUSTMENT'
);

create type public.captain_earning_status as enum (
  'PENDING',
  'AVAILABLE',
  'INCLUDED_IN_PAYOUT',
  'PAID',
  'REVERSED'
);

create type public.captain_payout_status as enum (
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'FAILED',
  'ON_HOLD'
);

create type public.captain_payout_entry_type as enum (
  'EARNING',
  'INCENTIVE',
  'PENALTY',
  'COD_ADJUSTMENT',
  'MANUAL_ADJUSTMENT'
);

create table public.merchant_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_number text not null,
  shop_id uuid not null,
  bank_account_id uuid not null,
  period_start date not null,
  period_end date not null,
  gross_sales_paise public.money_paise not null default 0,
  commission_paise public.money_paise not null default 0,
  discount_share_paise public.money_paise not null default 0,
  refund_deduction_paise public.money_paise not null default 0,
  tax_paise public.money_paise not null default 0,
  adjustment_paise bigint not null default 0,
  net_payable_paise bigint not null default 0,
  status public.merchant_settlement_status
    not null
    default 'DRAFT',
  provider_transfer_id text,
  scheduled_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint merchant_settlements_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint merchant_settlements_bank_account_id_fkey
    foreign key (bank_account_id)
    references public.shop_bank_accounts (id)
    on update cascade
    on delete restrict,

  constraint merchant_settlements_number_key
    unique (settlement_number),

  constraint merchant_settlements_shop_period_key
    unique (shop_id, period_start, period_end),

  constraint merchant_settlements_number_format
    check (
      settlement_number ~ '^[A-Z0-9][A-Z0-9-]*$'
    ),

  constraint merchant_settlements_period_check
    check (period_end >= period_start),

  constraint merchant_settlements_arithmetic
    check (
      net_payable_paise =
        gross_sales_paise
        - commission_paise
        - discount_share_paise
        - refund_deduction_paise
        - tax_paise
        + adjustment_paise
    ),

  constraint merchant_settlements_paid_lifecycle
    check (
      (
        status = 'PAID'
        and paid_at is not null
      )
      or (
        status <> 'PAID'
        and paid_at is null
      )
    ),

  constraint merchant_settlements_transfer_nonempty
    check (
      provider_transfer_id is null
      or length(btrim(provider_transfer_id)) > 0
    )
);

comment on table public.merchant_settlements is
  'Periodic merchant settlement with fees, refunds, and adjustments.';

create table public.merchant_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null,
  order_id uuid,
  refund_id uuid,
  entry_type public.merchant_settlement_entry_type not null,
  amount_paise bigint not null,
  description text,
  created_at timestamptz not null default now(),

  constraint merchant_settlement_items_settlement_id_fkey
    foreign key (settlement_id)
    references public.merchant_settlements (id)
    on update cascade
    on delete restrict,

  constraint merchant_settlement_items_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete set null,

  constraint merchant_settlement_items_refund_id_fkey
    foreign key (refund_id)
    references public.refunds (id)
    on update cascade
    on delete set null,

  constraint merchant_settlement_items_reference_count
    check (num_nonnulls(order_id, refund_id) <= 1),

  constraint merchant_settlement_items_reference_shape
    check (
      (
        entry_type = 'ORDER_CREDIT'
        and order_id is not null
      )
      or (
        entry_type = 'REFUND'
        and refund_id is not null
      )
      or entry_type not in ('ORDER_CREDIT', 'REFUND')
    ),

  constraint merchant_settlement_items_amount_nonzero
    check (amount_paise <> 0),

  constraint merchant_settlement_items_description_nonempty
    check (
      description is null
      or length(btrim(description)) > 0
    )
);

comment on table public.merchant_settlement_items is
  'Merchant settlement financial ledger rows.';

create table public.captain_earnings (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null,
  delivery_task_id uuid not null,
  base_fare_paise public.money_paise not null default 0,
  distance_fare_paise public.money_paise not null default 0,
  waiting_fee_paise public.money_paise not null default 0,
  peak_incentive_paise public.money_paise not null default 0,
  other_incentive_paise public.money_paise not null default 0,
  tip_paise public.money_paise not null default 0,
  penalty_paise public.money_paise not null default 0,
  total_paise bigint not null default 0,
  status public.captain_earning_status
    not null
    default 'PENDING',
  created_at timestamptz not null default now(),

  constraint captain_earnings_captain_id_fkey
    foreign key (captain_id)
    references public.captain_profiles (user_id)
    on update cascade
    on delete restrict,

  constraint captain_earnings_delivery_task_id_fkey
    foreign key (delivery_task_id)
    references public.delivery_tasks (id)
    on update cascade
    on delete restrict,

  constraint captain_earnings_delivery_task_key
    unique (delivery_task_id),

  constraint captain_earnings_arithmetic
    check (
      total_paise =
        base_fare_paise
        + distance_fare_paise
        + waiting_fee_paise
        + peak_incentive_paise
        + other_incentive_paise
        + tip_paise
        - penalty_paise
    )
);

comment on table public.captain_earnings is
  'Per-delivery captain earning and penalty calculation.';

create table public.captain_payouts (
  id uuid primary key default gen_random_uuid(),
  payout_number text not null,
  captain_id uuid not null,
  period_start date not null,
  period_end date not null,
  earnings_paise public.money_paise not null default 0,
  incentives_paise public.money_paise not null default 0,
  penalties_paise public.money_paise not null default 0,
  cod_adjustment_paise bigint not null default 0,
  net_payout_paise bigint not null default 0,
  status public.captain_payout_status
    not null
    default 'DRAFT',
  provider_transfer_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint captain_payouts_captain_id_fkey
    foreign key (captain_id)
    references public.captain_profiles (user_id)
    on update cascade
    on delete restrict,

  constraint captain_payouts_number_key
    unique (payout_number),

  constraint captain_payouts_captain_period_key
    unique (captain_id, period_start, period_end),

  constraint captain_payouts_number_format
    check (payout_number ~ '^[A-Z0-9][A-Z0-9-]*$'),

  constraint captain_payouts_period_check
    check (period_end >= period_start),

  constraint captain_payouts_arithmetic
    check (
      net_payout_paise =
        earnings_paise
        + incentives_paise
        - penalties_paise
        + cod_adjustment_paise
    ),

  constraint captain_payouts_paid_lifecycle
    check (
      (
        status = 'PAID'
        and paid_at is not null
      )
      or (
        status <> 'PAID'
        and paid_at is null
      )
    )
);

comment on table public.captain_payouts is
  'Periodic captain payout including COD adjustments.';

create table public.captain_payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null,
  captain_earning_id uuid,
  entry_type public.captain_payout_entry_type not null,
  amount_paise bigint not null,
  description text,
  created_at timestamptz not null default now(),

  constraint captain_payout_items_payout_id_fkey
    foreign key (payout_id)
    references public.captain_payouts (id)
    on update cascade
    on delete restrict,

  constraint captain_payout_items_captain_earning_id_fkey
    foreign key (captain_earning_id)
    references public.captain_earnings (id)
    on update cascade
    on delete set null,

  constraint captain_payout_items_earning_reference
    check (
      (
        entry_type = 'EARNING'
        and captain_earning_id is not null
      )
      or entry_type <> 'EARNING'
    ),

  constraint captain_payout_items_amount_nonzero
    check (amount_paise <> 0),

  constraint captain_payout_items_description_nonempty
    check (
      description is null
      or length(btrim(description)) > 0
    )
);

comment on table public.captain_payout_items is
  'Captain payout ledger linking earnings and adjustments.';

create trigger set_merchant_settlements_updated_at
before update on public.merchant_settlements
for each row
execute function public.set_updated_at();

create trigger set_captain_payouts_updated_at
before update on public.captain_payouts
for each row
execute function public.set_updated_at();

alter table public.merchant_settlements enable row level security;
alter table public.merchant_settlements force row level security;

alter table public.merchant_settlement_items enable row level security;
alter table public.merchant_settlement_items force row level security;

alter table public.captain_earnings enable row level security;
alter table public.captain_earnings force row level security;

alter table public.captain_payouts enable row level security;
alter table public.captain_payouts force row level security;

alter table public.captain_payout_items enable row level security;
alter table public.captain_payout_items force row level security;

revoke all privileges
on table
  public.merchant_settlements,
  public.merchant_settlement_items,
  public.captain_earnings,
  public.captain_payouts,
  public.captain_payout_items
from anon, authenticated;
