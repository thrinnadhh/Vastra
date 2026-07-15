-- S5A-04: owner-scoped Wardrobe reads/updates and access-first durable deletion.

create or replace function authz.can_upload_wardrobe_object(p_object_name text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from private.wardrobe_upload_intents intent
    where intent.owner_customer_id = auth.uid()
      and intent.storage_object_key = p_object_name
      and intent.consumed_at is null
      and intent.expires_at > statement_timestamp()
  );
$$;
revoke all on function authz.can_upload_wardrobe_object(text) from public;
grant execute on function authz.can_upload_wardrobe_object(text) to authenticated, service_role;

drop policy if exists wardrobe_media_owner_insert on storage.objects;
create policy wardrobe_media_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'wardrobe-media'
  and (select authz.is_active_customer())
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select authz.can_upload_wardrobe_object(name))
);

drop policy if exists wardrobe_media_owner_select on storage.objects;
drop policy if exists wardrobe_media_owner_update on storage.objects;
drop policy if exists wardrobe_media_owner_delete on storage.objects;

create table private.wardrobe_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  wardrobe_item_id uuid not null unique references public.wardrobe_items (id)
    on update cascade on delete cascade,
  bucket_id text not null default 'wardrobe-media',
  storage_object_key text not null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint wardrobe_deletion_jobs_bucket_check check (bucket_id = 'wardrobe-media'),
  constraint wardrobe_deletion_jobs_status_check check (status in ('PENDING','PROCESSING','FAILED','SUCCEEDED')),
  constraint wardrobe_deletion_jobs_attempts_check check (attempts >= 0)
);
create index wardrobe_deletion_jobs_retry_idx
on private.wardrobe_deletion_jobs (next_attempt_at, created_at)
where status in ('PENDING','FAILED','PROCESSING');
revoke all privileges on private.wardrobe_deletion_jobs from public, anon, authenticated, service_role;

create table private.wardrobe_item_delete_requests (
  customer_id uuid not null references public.customer_profiles (user_id) on delete cascade,
  idempotency_key uuid not null,
  wardrobe_item_id uuid not null,
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (customer_id, idempotency_key),
  constraint wardrobe_item_delete_request_object check (jsonb_typeof(request_payload) = 'object'),
  constraint wardrobe_item_delete_result_object check (result_payload is null or jsonb_typeof(result_payload) = 'object')
);
revoke all privileges on private.wardrobe_item_delete_requests from public, anon, authenticated, service_role;

create or replace function public.list_wardrobe_items(
  p_actor uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql security definer stable set search_path = ''
as $$
declare
  payload jsonb;
begin
  if p_actor is null or p_limit not between 1 and 100
    or ((p_cursor_created_at is null) <> (p_cursor_id is null)) then
    raise exception 'invalid wardrobe list request' using errcode = '22023';
  end if;
  if not private.is_active_customer_actor(p_actor) then
    raise exception 'active customer required' using errcode = '42501';
  end if;

  with page as (
    select item.*
    from public.wardrobe_items item
    where item.owner_customer_id = p_actor and item.status = 'ACTIVE'
      and (p_cursor_created_at is null or (item.created_at, item.id) < (p_cursor_created_at, p_cursor_id))
    order by item.created_at desc, item.id desc
    limit p_limit + 1
  ), visible as (
    select * from page order by created_at desc, id desc limit p_limit
  ), last_visible as (
    select * from visible order by created_at asc, id asc limit 1
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(private.build_wardrobe_item_payload(id) order by created_at desc, id desc) from visible), '[]'::jsonb),
    'nextCursor', case when (select count(*) from page) > p_limit
      then (select jsonb_build_object('createdAt', created_at, 'id', id) from last_visible)
      else null end
  ) into payload;
  return payload;
end;
$$;

create or replace function public.get_wardrobe_item(p_actor uuid, p_item_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare item_id uuid;
begin
  if p_actor is null or p_item_id is null then raise exception 'actor and item required' using errcode = '22023'; end if;
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  select item.id into item_id from public.wardrobe_items item
  where item.id = p_item_id and item.owner_customer_id = p_actor and item.status = 'ACTIVE';
  if not found then raise exception 'wardrobe item not found' using errcode = 'P0020'; end if;
  return private.build_wardrobe_item_payload(item_id);
end;
$$;

create or replace function public.update_wardrobe_item(p_actor uuid, p_item_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare item_row public.wardrobe_items;
begin
  if p_actor is null or p_item_id is null or p_patch is null or jsonb_typeof(p_patch) <> 'object'
    or p_patch = '{}'::jsonb
    or exists (select 1 from jsonb_object_keys(p_patch) key where key not in ('category','colour','occasion','season','notes'))
  then raise exception 'invalid wardrobe update' using errcode = '22023'; end if;
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;

  select * into item_row from public.wardrobe_items item
  where item.id = p_item_id and item.owner_customer_id = p_actor and item.status = 'ACTIVE'
  for update;
  if not found then raise exception 'wardrobe item not found' using errcode = 'P0020'; end if;

  update public.wardrobe_items item set
    category = case when p_patch ? 'category' then btrim(p_patch->>'category') else item.category end,
    colour = case when p_patch ? 'colour' then btrim(p_patch->>'colour') else item.colour end,
    occasion = case when p_patch ? 'occasion' then btrim(p_patch->>'occasion') else item.occasion end,
    season = case when p_patch ? 'season' then btrim(p_patch->>'season') else item.season end,
    notes = case when p_patch ? 'notes' then nullif(btrim(p_patch->>'notes'), '') else item.notes end,
    updated_at = statement_timestamp()
  where item.id = item_row.id;

  return private.build_wardrobe_item_payload(item_row.id);
exception when check_violation then
  raise exception 'invalid wardrobe update' using errcode = '22023';
end;
$$;

create or replace function public.delete_wardrobe_item(p_actor uuid, p_item_id uuid, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  request_payload jsonb := jsonb_build_object('wardrobeItemId', p_item_id);
  request_row private.wardrobe_item_delete_requests;
  item_row public.wardrobe_items;
  now_at timestamptz := statement_timestamp();
  result jsonb := jsonb_build_object('success', true);
begin
  if p_actor is null or p_item_id is null or p_idempotency_key is null then
    raise exception 'actor, item, and idempotency key required' using errcode = '22023';
  end if;
  if not private.is_active_customer_actor(p_actor) then raise exception 'active customer required' using errcode='42501'; end if;
  perform 1 from public.customer_profiles c where c.user_id = p_actor for update;

  insert into private.wardrobe_item_delete_requests(customer_id,idempotency_key,wardrobe_item_id,request_payload)
  values (p_actor,p_idempotency_key,p_item_id,request_payload)
  on conflict (customer_id,idempotency_key) do nothing returning * into request_row;
  if not found then
    select * into strict request_row from private.wardrobe_item_delete_requests r
    where r.customer_id = p_actor and r.idempotency_key = p_idempotency_key for update;
    if request_row.request_payload <> request_payload then raise exception 'idempotency conflict' using errcode = 'P0010'; end if;
    if request_row.result_payload is null then raise exception 'incomplete delete receipt' using errcode = '55000'; end if;
    return request_row.result_payload;
  end if;

  select * into item_row from public.wardrobe_items item
  where item.id = p_item_id and item.owner_customer_id = p_actor and item.status = 'ACTIVE' for update;
  if not found then raise exception 'wardrobe item not found' using errcode = 'P0020'; end if;

  update public.wardrobe_items item set status='DELETED', deleted_at=now_at, updated_at=now_at where item.id=item_row.id;
  insert into private.wardrobe_deletion_jobs(wardrobe_item_id,storage_object_key)
  values (item_row.id,item_row.storage_object_key) on conflict (wardrobe_item_id) do nothing;
  update private.wardrobe_item_delete_requests r set result_payload=result,completed_at=now_at
  where r.customer_id=p_actor and r.idempotency_key=p_idempotency_key;
  return result;
end;
$$;

create or replace function public.claim_wardrobe_deletion_job()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare job private.wardrobe_deletion_jobs;
begin
  select * into job from private.wardrobe_deletion_jobs j
  where (j.status in ('PENDING','FAILED') and j.next_attempt_at <= statement_timestamp())
     or (j.status='PROCESSING' and j.updated_at < statement_timestamp() - interval '5 minutes')
  order by j.next_attempt_at,j.created_at,j.id limit 1 for update skip locked;
  if not found then return null; end if;
  update private.wardrobe_deletion_jobs j set status='PROCESSING',attempts=j.attempts+1,updated_at=statement_timestamp()
  where j.id=job.id;
  return jsonb_build_object('jobId',job.id,'objectKey',job.storage_object_key);
end;
$$;

create or replace function public.complete_wardrobe_deletion_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update private.wardrobe_deletion_jobs j set status='SUCCEEDED',completed_at=statement_timestamp(),updated_at=statement_timestamp(),last_error_code=null
  where j.id=p_job_id and j.status='PROCESSING';
end;
$$;

create or replace function public.fail_wardrobe_deletion_job(p_job_id uuid,p_error_code text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update private.wardrobe_deletion_jobs j set status='FAILED',last_error_code=left(coalesce(p_error_code,'UNKNOWN'),100),
    next_attempt_at=statement_timestamp() + make_interval(secs => least(3600, power(2,least(greatest(j.attempts,1),7))::integer * 30)),
    updated_at=statement_timestamp()
  where j.id=p_job_id and j.status='PROCESSING';
end;
$$;

revoke all on function public.list_wardrobe_items(uuid,timestamptz,uuid,integer) from public,anon,authenticated;
revoke all on function public.get_wardrobe_item(uuid,uuid) from public,anon,authenticated;
revoke all on function public.update_wardrobe_item(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.delete_wardrobe_item(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.claim_wardrobe_deletion_job() from public,anon,authenticated;
revoke all on function public.complete_wardrobe_deletion_job(uuid) from public,anon,authenticated;
revoke all on function public.fail_wardrobe_deletion_job(uuid,text) from public,anon,authenticated;
grant execute on function public.list_wardrobe_items(uuid,timestamptz,uuid,integer) to service_role;
grant execute on function public.get_wardrobe_item(uuid,uuid) to service_role;
grant execute on function public.update_wardrobe_item(uuid,uuid,jsonb) to service_role;
grant execute on function public.delete_wardrobe_item(uuid,uuid,uuid) to service_role;
grant execute on function public.claim_wardrobe_deletion_job() to service_role;
grant execute on function public.complete_wardrobe_deletion_job(uuid) to service_role;
grant execute on function public.fail_wardrobe_deletion_job(uuid,text) to service_role;
