-- Publish the Phase 2D branch-aware RPCs while restoring legacy entry points.

alter function public.create_customer_checkout_quote(uuid, uuid)
  rename to create_customer_branch_checkout_quote;

alter function public.create_customer_checkout_quote_legacy(uuid, uuid)
  rename to create_customer_checkout_quote;

alter function public.place_customer_cod_order(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  rename to place_customer_branch_cod_order;

alter function public.place_customer_cod_order_legacy(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  rename to place_customer_cod_order;

alter function public.prepare_customer_online_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  rename to prepare_customer_branch_online_payment;

alter function public.prepare_customer_online_payment_legacy(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  rename to prepare_customer_online_payment;

alter function public.attach_customer_payment_session(
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  timestamptz
)
  rename to attach_customer_branch_payment_session;

alter function public.attach_customer_payment_session_legacy(
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  timestamptz
)
  rename to attach_customer_payment_session;

revoke all
on function public.create_customer_branch_checkout_quote(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.create_customer_branch_checkout_quote(uuid, uuid)
to service_role;

revoke all
on function public.place_customer_branch_cod_order(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.place_customer_branch_cod_order(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
to service_role;

revoke all
on function public.prepare_customer_branch_online_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.prepare_customer_branch_online_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
to service_role;

revoke all
on function public.attach_customer_branch_payment_session(
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  timestamptz
)
from public, anon, authenticated;

grant execute
on function public.attach_customer_branch_payment_session(
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  timestamptz
)
to service_role;
