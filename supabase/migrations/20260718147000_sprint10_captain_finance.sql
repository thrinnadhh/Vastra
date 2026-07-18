create table if not exists public.captain_cod_ledger (
  id bigint generated always as identity primary key,
  cod_collection_id uuid not null references public.cod_collections(id),
  captain_id uuid not null references public.captain_profiles(user_id),
  entry_type text not null check(entry_type in ('COLLECTED','DEPOSIT','ADJUSTMENT')),
  amount_paise bigint not null check(amount_paise<>0),
  liability_after_paise bigint not null,
  actor_id uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now(),
  constraint captain_cod_ledger_note_nonempty check(note is null or length(btrim(note))>0)
);
create unique index if not exists captain_cod_ledger_collection_collected_idx
  on public.captain_cod_ledger(cod_collection_id) where entry_type='COLLECTED';
create unique index if not exists captain_cod_ledger_collection_deposit_idx
  on public.captain_cod_ledger(cod_collection_id) where entry_type='DEPOSIT';
create unique index if not exists captain_payout_items_one_earning_idx
  on public.captain_payout_items(captain_earning_id) where captain_earning_id is not null;
alter table public.captain_cod_ledger enable row level security;
alter table public.captain_cod_ledger force row level security;
revoke all on public.captain_cod_ledger from public,anon,authenticated;
grant select,insert on public.captain_cod_ledger to service_role;
create trigger prevent_captain_cod_ledger_mutation before update or delete on public.captain_cod_ledger
for each row execute function private.prevent_append_only_mutation();

create or replace function private.record_cod_liability()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('COLLECTED','DEPOSIT_PENDING','DEPOSITED','RECONCILED','DISPUTED') then
    insert into public.captain_cod_ledger(cod_collection_id,captain_id,entry_type,amount_paise,liability_after_paise,note)
    values(new.id,new.captain_id,'COLLECTED',new.amount_paise,new.amount_paise,'COD collected from customer')
    on conflict do nothing;
  end if;
  return new;
end; $$;
create trigger record_cod_liability after insert or update of status on public.cod_collections
for each row execute function private.record_cod_liability();
insert into public.captain_cod_ledger(cod_collection_id,captain_id,entry_type,amount_paise,liability_after_paise,note)
select id,captain_id,'COLLECTED',amount_paise,amount_paise,'COD collected from customer'
from public.cod_collections where status<>'PENDING_COLLECTION' on conflict do nothing;

create or replace function private.ensure_captain_earning()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_payment public.order_payment_status;
begin
  if new.status='COMPLETED'
    and new.task_type='FORWARD_DELIVERY'
    and new.order_id is not null
    and new.assigned_captain_id is not null then
    select payment_status into v_payment from public.orders where id=new.order_id;
    insert into public.captain_earnings(captain_id,delivery_task_id,base_fare_paise,total_paise,status)
    values(new.assigned_captain_id,new.id,new.captain_earning_paise,new.captain_earning_paise,
      case when v_payment in ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED') then 'AVAILABLE' else 'PENDING' end)
    on conflict(delivery_task_id) do nothing;
  end if;
  return new;
end; $$;
create trigger ensure_captain_earning after update of status on public.delivery_tasks
for each row when(old.status is distinct from new.status and new.status='COMPLETED') execute function private.ensure_captain_earning();

create or replace function public.admin_list_cod_collections(p_status text,p_limit integer default 25)
returns jsonb language sql security definer set search_path='' stable as $$
select coalesce(jsonb_agg(payload order by collected_at desc,id desc),'[]'::jsonb) from(
  select c.id,c.collected_at,jsonb_build_object('collectionId',c.id,'orderId',c.order_id,'deliveryTaskId',c.delivery_task_id,
    'captainId',c.captain_id,'amountPaise',c.amount_paise,'status',c.status,'collectedAt',c.collected_at,
    'depositedAt',c.deposited_at,'reconciledAt',c.reconciled_at,
    'earningStatus',(select e.status from public.captain_earnings e where e.delivery_task_id=c.delivery_task_id)) payload
  from public.cod_collections c where (p_status is null or c.status::text=p_status)
  order by c.collected_at desc nulls last,c.id desc limit greatest(1,least(coalesce(p_limit,25),100))
) q; $$;

create or replace function public.admin_reconcile_cod_collection(
  p_actor_id uuid,p_collection_id uuid,p_deposited_amount_paise bigint,p_idempotency_key uuid,p_note text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_collection public.cod_collections; v_captain public.captain_profiles; v_earning public.captain_earnings; v_receipt private.admin_command_receipts; v_hash text; v_result jsonb; v_audit uuid; v_variance bigint;
begin
  if p_actor_id is null or p_collection_id is null or p_idempotency_key is null or p_deposited_amount_paise<1 then raise exception 'FINANCE_REQUEST_INVALID'; end if;
  perform 1 from public.profiles where id=p_actor_id and account_type='ADMIN' and status='ACTIVE'; if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;
  v_hash:=encode(extensions.digest(concat_ws('|',p_collection_id::text,p_deposited_amount_paise::text,coalesce(nullif(btrim(p_note),''),'')),'sha256'),'hex');
  insert into private.admin_command_receipts(actor_id,action,idempotency_key,request_fingerprint)
  values(p_actor_id,'finance.cod.reconcile',p_idempotency_key,v_hash) on conflict do nothing returning * into v_receipt;
  if not found then
    select * into strict v_receipt from private.admin_command_receipts where actor_id=p_actor_id and action='finance.cod.reconcile' and idempotency_key=p_idempotency_key for update;
    if v_receipt.request_fingerprint<>v_hash then raise exception 'FINANCE_IDEMPOTENCY_CONFLICT'; end if;
    if v_receipt.result_payload is null then raise exception 'FINANCE_REQUEST_INCOMPLETE'; end if;
    return v_receipt.result_payload||jsonb_build_object('replayed',true);
  end if;
  select * into v_collection from public.cod_collections where id=p_collection_id for update;
  if not found then raise exception 'FINANCE_PAYMENT_NOT_FOUND'; end if;
  if v_collection.status not in ('COLLECTED','DEPOSIT_PENDING','DEPOSITED','DISPUTED') then raise exception 'FINANCE_PAYMENT_STATE_CONFLICT'; end if;
  select * into strict v_captain from public.captain_profiles where user_id=v_collection.captain_id for update;
  select * into v_earning from public.captain_earnings where delivery_task_id=v_collection.delivery_task_id for update;
  v_variance:=v_collection.amount_paise-p_deposited_amount_paise;
  insert into public.captain_cod_ledger(cod_collection_id,captain_id,entry_type,amount_paise,liability_after_paise,actor_id,note)
  values(v_collection.id,v_collection.captain_id,'DEPOSIT',-p_deposited_amount_paise,greatest(v_variance,0),p_actor_id,
    coalesce(nullif(btrim(p_note),''),'COD deposit reconciliation'));
  update public.captain_profiles set cash_balance_paise=greatest(0,cash_balance_paise-p_deposited_amount_paise),updated_at=transaction_timestamp()
  where user_id=v_collection.captain_id;
  if v_variance=0 then
    update public.cod_collections set status='RECONCILED',deposited_at=coalesce(deposited_at,transaction_timestamp()),reconciled_by=p_actor_id,reconciled_at=transaction_timestamp()
    where id=v_collection.id;
    update public.captain_earnings set status='AVAILABLE' where delivery_task_id=v_collection.delivery_task_id and status='PENDING';
  else
    update public.cod_collections set status='DISPUTED' where id=v_collection.id;
  end if;
  v_result:=jsonb_build_object('collectionId',v_collection.id,'captainId',v_collection.captain_id,'expectedAmountPaise',v_collection.amount_paise,
    'depositedAmountPaise',p_deposited_amount_paise,'variancePaise',v_variance,'status',case when v_variance=0 then 'RECONCILED' else 'DISPUTED' end,'replayed',false);
  insert into private.admin_audit_log(actor_id,action,resource_type,resource_id,reason_code,note,idempotency_key,before_state,after_state)
  values(p_actor_id,'finance.cod.reconcile','COD_RECONCILIATION',v_collection.id,'COD_RECONCILIATION',nullif(btrim(p_note),''),p_idempotency_key,
    jsonb_build_object('status',v_collection.status,'amountPaise',v_collection.amount_paise),v_result) returning id into v_audit;
  update private.admin_command_receipts set audit_id=v_audit,result_payload=v_result,completed_at=transaction_timestamp()
  where actor_id=p_actor_id and action='finance.cod.reconcile' and idempotency_key=p_idempotency_key;
  return v_result;
end; $$;

create or replace function public.get_captain_payout_eligibility(p_captain_id uuid,p_period_start date,p_period_end date)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_count integer; v_amount bigint; v_blocked integer;
begin
  if p_captain_id is null or p_period_start is null or p_period_end is null or p_period_end<p_period_start then raise exception 'FINANCE_REQUEST_INVALID'; end if;
  select count(*),coalesce(sum(total_paise),0) into v_count,v_amount from public.captain_earnings
  where captain_id=p_captain_id and status='AVAILABLE' and created_at::date between p_period_start and p_period_end;
  select count(*) into v_blocked from public.cod_collections where captain_id=p_captain_id and status<>'RECONCILED';
  return jsonb_build_object('captainId',p_captain_id,'periodStart',p_period_start,'periodEnd',p_period_end,
    'eligible',v_count>0 and v_blocked=0,'earningCount',v_count,'amountPaise',v_amount,'blockedCodCount',v_blocked);
end; $$;

create or replace function public.admin_create_captain_payout(
  p_actor_id uuid,p_captain_id uuid,p_period_start date,p_period_end date,p_idempotency_key uuid,p_note text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_receipt private.admin_command_receipts; v_hash text; v_payout public.captain_payouts; v_earnings bigint; v_incentives bigint; v_penalties bigint; v_net bigint; v_count integer; v_audit uuid; v_result jsonb;
begin
  if p_actor_id is null or p_captain_id is null or p_period_start is null or p_period_end is null or p_period_end<p_period_start or p_idempotency_key is null then raise exception 'FINANCE_REQUEST_INVALID'; end if;
  perform 1 from public.profiles where id=p_actor_id and account_type='ADMIN' and status='ACTIVE'; if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;
  v_hash:=encode(extensions.digest(concat_ws('|',p_captain_id::text,p_period_start::text,p_period_end::text,coalesce(nullif(btrim(p_note),''),'')),'sha256'),'hex');
  insert into private.admin_command_receipts(actor_id,action,idempotency_key,request_fingerprint)
  values(p_actor_id,'finance.payout.create',p_idempotency_key,v_hash) on conflict do nothing returning * into v_receipt;
  if not found then
    select * into strict v_receipt from private.admin_command_receipts where actor_id=p_actor_id and action='finance.payout.create' and idempotency_key=p_idempotency_key for update;
    if v_receipt.request_fingerprint<>v_hash then raise exception 'FINANCE_IDEMPOTENCY_CONFLICT'; end if;
    if v_receipt.result_payload is null then raise exception 'FINANCE_REQUEST_INCOMPLETE'; end if;
    return v_receipt.result_payload||jsonb_build_object('replayed',true);
  end if;
  perform 1 from public.captain_profiles where user_id=p_captain_id for update; if not found then raise exception 'FINANCE_PAYMENT_NOT_FOUND'; end if;
  perform 1 from public.captain_earnings where captain_id=p_captain_id and status='AVAILABLE' and created_at::date between p_period_start and p_period_end order by id for update;
  select count(*),coalesce(sum(base_fare_paise+distance_fare_paise+waiting_fee_paise+tip_paise),0),
    coalesce(sum(peak_incentive_paise+other_incentive_paise),0),coalesce(sum(penalty_paise),0),coalesce(sum(total_paise),0)
  into v_count,v_earnings,v_incentives,v_penalties,v_net from public.captain_earnings
  where captain_id=p_captain_id and status='AVAILABLE' and created_at::date between p_period_start and p_period_end;
  if v_count=0 then raise exception 'FINANCE_PAYOUT_NOT_ELIGIBLE'; end if;
  if exists(select 1 from public.cod_collections where captain_id=p_captain_id and status<>'RECONCILED') then raise exception 'FINANCE_COD_NOT_RECONCILED'; end if;
  insert into public.captain_payouts(payout_number,captain_id,period_start,period_end,earnings_paise,incentives_paise,penalties_paise,cod_adjustment_paise,net_payout_paise,status)
  values('VASPAYOUT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_captain_id,p_period_start,p_period_end,v_earnings,v_incentives,v_penalties,0,v_net,'REVIEW') returning * into v_payout;
  insert into public.captain_payout_items(payout_id,captain_earning_id,entry_type,amount_paise,description)
  select v_payout.id,id,'EARNING',total_paise,'Completed delivery earning' from public.captain_earnings
  where captain_id=p_captain_id and status='AVAILABLE' and created_at::date between p_period_start and p_period_end order by id;
  update public.captain_earnings set status='INCLUDED_IN_PAYOUT'
  where captain_id=p_captain_id and status='AVAILABLE' and created_at::date between p_period_start and p_period_end;
  v_result:=jsonb_build_object('payoutId',v_payout.id,'payoutNumber',v_payout.payout_number,'captainId',p_captain_id,'status','REVIEW',
    'earningCount',v_count,'netPayoutPaise',v_net,'replayed',false);
  insert into private.admin_audit_log(actor_id,action,resource_type,resource_id,reason_code,note,idempotency_key,before_state,after_state)
  values(p_actor_id,'finance.payout.create','CAPTAIN_PAYOUT',v_payout.id,'PAYOUT_CYCLE',nullif(btrim(p_note),''),p_idempotency_key,
    jsonb_build_object('captainId',p_captain_id,'periodStart',p_period_start,'periodEnd',p_period_end),v_result) returning id into v_audit;
  update private.admin_command_receipts set audit_id=v_audit,result_payload=v_result,completed_at=transaction_timestamp()
  where actor_id=p_actor_id and action='finance.payout.create' and idempotency_key=p_idempotency_key;
  return v_result;
end; $$;

create or replace function public.get_captain_payout(p_payout_id uuid)
returns jsonb language sql security definer set search_path='' stable as $$
select jsonb_build_object('payoutId',p.id,'payoutNumber',p.payout_number,'captainId',p.captain_id,'periodStart',p.period_start,
  'periodEnd',p.period_end,'earningsPaise',p.earnings_paise,'incentivesPaise',p.incentives_paise,'penaltiesPaise',p.penalties_paise,
  'codAdjustmentPaise',p.cod_adjustment_paise,'netPayoutPaise',p.net_payout_paise,'status',p.status,'createdAt',p.created_at,
  'items',coalesce((select jsonb_agg(jsonb_build_object('itemId',i.id,'earningId',i.captain_earning_id,'entryType',i.entry_type,
    'amountPaise',i.amount_paise,'description',i.description) order by i.created_at,i.id) from public.captain_payout_items i where i.payout_id=p.id),'[]'::jsonb))
from public.captain_payouts p where p.id=p_payout_id; $$;

revoke all on function public.admin_list_cod_collections(text,integer) from public,anon,authenticated;
revoke all on function public.admin_reconcile_cod_collection(uuid,uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.get_captain_payout_eligibility(uuid,date,date) from public,anon,authenticated;
revoke all on function public.admin_create_captain_payout(uuid,uuid,date,date,uuid,text) from public,anon,authenticated;
revoke all on function public.get_captain_payout(uuid) from public,anon,authenticated;
grant execute on function public.admin_list_cod_collections(text,integer) to service_role;
grant execute on function public.admin_reconcile_cod_collection(uuid,uuid,bigint,uuid,text) to service_role;
grant execute on function public.get_captain_payout_eligibility(uuid,date,date) to service_role;
grant execute on function public.admin_create_captain_payout(uuid,uuid,date,date,uuid,text) to service_role;
grant execute on function public.get_captain_payout(uuid) to service_role;
