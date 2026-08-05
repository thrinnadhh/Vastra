-- Remote migration-ledger alignment for the emergency packing deployment.
--
-- The functional migration remains 20260716033000_merchant_order_packing.sql.
-- Supabase applied that exact SQL on 2026-08-05 under this generated version.
-- This verification-only migration keeps local and remote migration histories
-- aligned without rewriting the released historical migration.

do $$
begin
  if to_regprocedure(
    'public.start_merchant_order_packing(uuid,uuid)'
  ) is null then
    raise exception 'start_merchant_order_packing is missing';
  end if;

  if to_regprocedure(
    'public.get_merchant_order_packing_list(uuid,uuid)'
  ) is null then
    raise exception 'get_merchant_order_packing_list is missing';
  end if;

  if to_regprocedure(
    'public.verify_merchant_order_item(uuid,uuid,uuid,text,text)'
  ) is null then
    raise exception 'verify_merchant_order_item is missing';
  end if;
end;
$$;
