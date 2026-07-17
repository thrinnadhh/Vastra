-- S8-02 forward fix: retain the established append-only location time invariant.
-- Client clock skew is accepted at the command boundary, while durable history stores
-- received_at at or after recorded_at so downstream ordering remains deterministic.

alter table public.captain_location_history
  drop constraint if exists captain_location_history_clock_skew_check;

alter table public.captain_location_history
  add constraint captain_location_history_received_order
  check (received_at >= recorded_at);
