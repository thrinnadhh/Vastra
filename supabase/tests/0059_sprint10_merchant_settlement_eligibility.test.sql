begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select has_table('private', 'finance_command_receipts', 'finance idempotency receipts exist');
select ok(to_regprocedure('public.get_merchant_settlement_eligibility(uuid,date,date)') is not null, 'settlement eligibility RPC exists');
select ok(to_regprocedure('public.create_merchant_settlement_ledger(uuid,uuid,date,date,text,text,uuid)') is not null, 'settlement ledger creation RPC exists');
select ok(to_regprocedure('public.get_merchant_settlement_detail(uuid)') is not null, 'settlement detail RPC exists');
select ok(not has_function_privilege('authenticated', 'public.create_merchant_settlement_ledger(uuid,uuid,date,date,text,text,uuid)', 'EXECUTE'), 'clients cannot freeze settlement ledgers');
select ok(has_function_privilege('service_role', 'public.create_merchant_settlement_ledger(uuid,uuid,date,date,text,text,uuid)', 'EXECUTE'), 'service role can freeze settlement ledgers');
select ok(has_table_privilege('service_role', 'private.finance_command_receipts', 'UPDATE'), 'service role can complete finance receipts');
select has_index('public', 'merchant_settlement_items', 'merchant_settlement_items_one_order_credit_idx', 'an order can be credited once');
select has_index('public', 'merchant_settlement_items', 'merchant_settlement_items_one_refund_idx', 'a refund can be deducted once');

select * from finish();
rollback;
