-- Preserve the existing checkout RPCs during the Phase 2D stacked rollout.
--
-- Phase 2D-A installs branch-aware implementations without switching current
-- backend consumers. Phase 2D-B changes the backend to the explicit branch RPCs.

alter function public.create_customer_checkout_quote(uuid, uuid)
  rename to create_customer_checkout_quote_legacy;

alter function public.place_customer_cod_order(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  rename to place_customer_cod_order_legacy;

alter function public.prepare_customer_online_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  rename to prepare_customer_online_payment_legacy;

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
  rename to attach_customer_payment_session_legacy;
