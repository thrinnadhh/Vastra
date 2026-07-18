-- S9-10: enforce immutable admin audit records and strengthen idempotency receipts.

drop trigger if exists prevent_admin_audit_log_mutation
  on private.admin_audit_log;
create trigger prevent_admin_audit_log_mutation
before update or delete on private.admin_audit_log
for each row execute function private.prevent_append_only_mutation();

create unique index if not exists admin_audit_command_unique_idx
  on private.admin_audit_log(actor_id, action, idempotency_key);

revoke update, delete on private.admin_audit_log from service_role;
revoke update, delete on private.admin_case_history from service_role;
revoke update, delete on private.system_setting_versions from service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.admin_command_receipts'::regclass
      and conname = 'admin_command_receipts_audit_id_fkey'
  ) then
    alter table private.admin_command_receipts
      add constraint admin_command_receipts_audit_id_fkey
      foreign key (audit_id)
      references private.admin_audit_log(id)
      on update restrict
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.admin_command_receipts'::regclass
      and conname = 'admin_command_receipts_action_length'
  ) then
    alter table private.admin_command_receipts
      add constraint admin_command_receipts_action_length
      check (length(action) between 3 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.admin_command_receipts'::regclass
      and conname = 'admin_command_receipts_fingerprint_sha256'
  ) then
    alter table private.admin_command_receipts
      add constraint admin_command_receipts_fingerprint_sha256
      check (request_fingerprint ~ '^[0-9a-f]{64}$');
  end if;
end;
$$;
