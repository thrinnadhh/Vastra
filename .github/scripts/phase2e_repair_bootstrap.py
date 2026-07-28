from pathlib import Path

path = Path('.github/scripts/phase2e_repair.py')
text = path.read_text()

scope_old = "        where aca.admin_user_id = p_actor_id\\n          and aca.city_id = c.id\\n          and aca.revoked_at is null\\n"
scope_new = "       where aca.admin_user_id = p_actor_id\\n         and aca.city_id = c.id\\n         and aca.revoked_at is null\\n"
if text.count(scope_old) != 1:
    raise SystemExit(f'bootstrap expected one scope-predicate patch target, found {text.count(scope_old)}')
text = text.replace(scope_old, scope_new, 1)

fixture_old = ");\\nupdate public.merchant_branches\\nset verification_status = 'VERIFIED', geography_status = 'VERIFIED', status = 'VERIFICATION_PENDING'\\nwhere id = 'e3e00000-0000-4000-8000-000000000001';\\n"
fixture_new = ");\\ninsert into public.branch_service_zones (branch_id, city_id, service_zone_id, is_primary, is_active)\\nvalues (\\n  'e3e00000-0000-4000-8000-000000000001',\\n  'e3100000-0000-4000-8000-000000000001',\\n  'e3400000-0000-4000-8000-000000000001',\\n  true,\\n  true\\n);\\nupdate public.merchant_branches\\nset verification_status = 'VERIFIED', geography_status = 'VERIFIED', status = 'VERIFICATION_PENDING'\\nwhere id = 'e3e00000-0000-4000-8000-000000000001';\\n"
if text.count(fixture_old) != 1:
    raise SystemExit(f'bootstrap expected one branch fixture patch target, found {text.count(fixture_old)}')
text = text.replace(fixture_old, fixture_new, 1)
path.write_text(text)

migration = Path('supabase/migrations/20260728113000_phase_2e_city_activation.sql')
migration_text = migration.read_text()
marker = "\nalter table public.service_zones\n  add column if not exists version integer not null default 1;\n"
replacement = """

create or replace function public.record_admin_audit(
  p_actor_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid,
  p_before_state jsonb,
  p_after_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_receipt private.admin_command_receipts%rowtype;
  v_audit private.admin_audit_log%rowtype;
begin
  if p_actor_id is null or p_resource_id is null or p_idempotency_key is null then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_resource_type,
        p_resource_id::text,
        p_reason_code,
        coalesce(p_note, ''),
        coalesce(p_before_state, 'null'::jsonb)::text,
        coalesce(p_after_state, 'null'::jsonb)::text
      ),
      'sha256'
    ),
    'hex'
  );

  insert into private.admin_command_receipts(actor_id, action, idempotency_key, request_fingerprint)
  values (p_actor_id, p_action, p_idempotency_key, v_fingerprint)
  on conflict do nothing;

  select * into v_receipt
  from private.admin_command_receipts
  where actor_id = p_actor_id
    and action = p_action
    and idempotency_key = p_idempotency_key
  for update;

  if v_receipt.request_fingerprint <> v_fingerprint then
    raise exception 'ADMIN_IDEMPOTENCY_CONFLICT';
  end if;

  if v_receipt.audit_id is not null then
    select * into v_audit from private.admin_audit_log where id = v_receipt.audit_id;
    return to_jsonb(v_audit);
  end if;

  insert into private.admin_audit_log(
    actor_id,
    action,
    resource_type,
    resource_id,
    reason_code,
    note,
    request_id,
    idempotency_key,
    before_state,
    after_state
  ) values (
    p_actor_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_reason_code,
    nullif(trim(p_note), ''),
    nullif(trim(p_request_id), ''),
    p_idempotency_key,
    p_before_state,
    p_after_state
  ) returning * into v_audit;

  update private.admin_command_receipts
  set audit_id = v_audit.id
  where actor_id = p_actor_id
    and action = p_action
    and idempotency_key = p_idempotency_key;

  return to_jsonb(v_audit);
end;
$$;
""" + marker
if migration_text.count(marker) != 1:
    raise SystemExit(f'bootstrap expected one audit-function insertion point, found {migration_text.count(marker)}')
migration.write_text(migration_text.replace(marker, replacement, 1))
