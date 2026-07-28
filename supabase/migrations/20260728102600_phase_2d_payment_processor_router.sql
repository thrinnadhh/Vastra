-- Route contract-v1 payments through the untouched Sprint 10 processor and
-- contract-v2 payments through the Phase 2D branch-aware processor.

alter function private.apply_verified_payment_event(bigint)
  rename to apply_verified_payment_event_phase_2d_router;

create or replace function private.apply_verified_payment_event(
  p_event_id bigint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_version integer;
begin
  select o.order_contract_version
  into v_contract_version
  from public.payment_events pe
  join public.payments p
    on p.id = pe.payment_id
  join public.orders o
    on o.id = p.order_id
  where pe.id = p_event_id;

  if not found or coalesce(v_contract_version, 1) <> 2 then
    -- The Sprint 10 delegate retains its private.release_inventory_reservation
    -- failure path and authoritative row locking with FOR UPDATE.
    return private.apply_verified_payment_event_phase_2d_legacy(
      p_event_id
    );
  end if;

  -- The Phase 2D delegate converts exact branch holds before transitioning the
  -- order to WAITING_FOR_MERCHANT through private.transition_order_state.
  return private.apply_verified_payment_event_phase_2d_router(
    p_event_id
  );
end;
$$;

revoke all
on function private.apply_verified_payment_event_phase_2d_router(bigint)
from public, anon, authenticated;

revoke all
on function private.apply_verified_payment_event(bigint)
from public, anon, authenticated;

grant execute
on function private.apply_verified_payment_event(bigint)
to service_role;
