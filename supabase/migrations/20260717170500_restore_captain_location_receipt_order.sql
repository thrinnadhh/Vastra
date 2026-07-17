-- S8-02 forward fix: retain the established append-only location time invariant.

alter table public.captain_location_history
  drop constraint if exists captain_location_history_clock_skew_check;

alter table public.captain_location_history
  add constraint captain_location_history_received_order
  check (received_at >= recorded_at);
