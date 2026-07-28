from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


def replace_exact_count(path: str, old: str, new: str, expected: int) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new))


# Native modal lifecycle.
page = "apps/admin-dashboard/src/app/cities/page.tsx"
replace_once(
    page,
    "  const idempotencyKey = useRef(createIdempotencyKey());\n  const dialog = useRef<HTMLDialogElement>(null);\n\n  useEffect(() => {\n    dialog.current?.focus();\n    const closeOnEscape = (event: KeyboardEvent) => {\n      if (event.key === 'Escape' && !busy) onClose();\n    };\n    globalThis.addEventListener('keydown', closeOnEscape);\n    return () => globalThis.removeEventListener('keydown', closeOnEscape);\n  }, [busy, onClose]);\n",
    "  const idempotencyKey = useRef(createIdempotencyKey());\n  const dialog = useRef<HTMLDialogElement>(null);\n  const busyRef = useRef(busy);\n  const onCloseRef = useRef(onClose);\n  busyRef.current = busy;\n  onCloseRef.current = onClose;\n\n  useEffect(() => {\n    const element = dialog.current;\n    if (element === null) return;\n    if (!element.open) element.showModal();\n\n    const cancel = (event: Event) => {\n      event.preventDefault();\n      if (busyRef.current) return;\n      element.close();\n      onCloseRef.current();\n    };\n\n    element.addEventListener('cancel', cancel);\n    return () => {\n      element.removeEventListener('cancel', cancel);\n      if (element.open) element.close();\n    };\n  }, []);\n\n  const requestClose = () => {\n    if (busyRef.current) return;\n    if (dialog.current?.open) dialog.current.close();\n    onCloseRef.current();\n  };\n",
)
replace_once(
    page,
    "    onCompleted(result.data);\n",
    "    if (dialog.current?.open) dialog.current.close();\n    onCompleted(result.data);\n",
)
replace_once(
    page,
    "        className=\"operation-dialog\"\n        open\n        ref={dialog}\n        tabIndex={-1}\n",
    "        className=\"operation-dialog\"\n        ref={dialog}\n",
)
replace_once(
    page,
    "disabled={busy} onClick={onClose} type=\"button\"",
    "disabled={busy} onClick={requestClose} type=\"button\"",
)

# Exact lifecycle error contracts.
gateway = "apps/backend/src/admin/admin-city.gateway.ts"
replace_once(
    gateway,
    "  if (message.includes('INVALID') || message.includes('ACTIVATION_REQUIRES')) {\n    throw new AdminCityInputRejectedError();\n  }\n  if (message.includes('TRANSITION') || message.includes('STATE')) {\n    throw new AdminCityStateConflictError();\n  }\n",
    "  if (message.includes('ADMIN_CITY_TRANSITION_STATE_CONFLICT')) {\n    throw new AdminCityStateConflictError();\n  }\n  if (\n    message.includes('ADMIN_CITY_TRANSITION_TARGET_INVALID') ||\n    message.includes('INVALID') ||\n    message.includes('ACTIVATION_REQUIRES')\n  ) {\n    throw new AdminCityInputRejectedError();\n  }\n",
)

gateway_test = "apps/backend/src/admin/admin-city.gateway.test.ts"
replace_once(
    gateway_test,
    "  AdminCityGatewayUnavailableError,\n  AdminCityVersionConflictError,\n",
    "  AdminCityGatewayUnavailableError,\n  AdminCityStateConflictError,\n  AdminCityVersionConflictError,\n",
)
replace_once(
    gateway_test,
    "  it('maps database version conflicts without losing the authoritative error', async () => {",
    "  it('maps illegal lifecycle transitions to a state conflict', async () => {\n    const rpc = vi.fn().mockResolvedValue({\n      data: null,\n      error: { message: 'ADMIN_CITY_TRANSITION_STATE_CONFLICT' },\n    });\n    const gateway = new SupabaseAdminCityGateway({ rpc } as unknown as SupabaseClient);\n    await expect(\n      gateway.transition({\n        actorId: ACTOR_ID,\n        cityId: CITY_ID,\n        targetStatus: 'PAUSED',\n        reasonCode: 'OPERATIONAL_RECOVERY',\n        note: null,\n        requestId: null,\n        idempotencyKey: '30000000-0000-4000-8000-000000000002',\n      }),\n    ).rejects.toBeInstanceOf(AdminCityStateConflictError);\n  });\n\n  it('maps database version conflicts without losing the authoritative error', async () => {",
)

# OpenAPI create/update separation and create-route 404s.
openapi = "docs/api/openapi.yaml"
replace_once(
    openapi,
    "    AdminServiceZoneUpdateRequest:\n      type: object\n      additionalProperties: false\n      required: [patch, reasonCode]\n      properties:\n        expectedVersion: {type: ['integer', 'null'], minimum: 1}\n        patch: {type: object, minProperties: 1}\n        reasonCode: {$ref: '#/components/schemas/AdminMutationReasonCode'}\n        note: {type: ['string', 'null'], minLength: 1, maxLength: 1000}\n    AdminServiceZonePincodeUpdateRequest:\n      type: object\n      additionalProperties: false\n      required: [pincode, priority, isPrimary, isActive, reasonCode]\n      properties:\n        expectedVersion: {type: ['integer', 'null'], minimum: 1}\n        pincode: {type: string, pattern: '^[1-9][0-9]{5}$'}\n        priority: {type: integer, minimum: 1}\n        isPrimary: {type: boolean}\n        isActive: {type: boolean}\n        reasonCode: {$ref: '#/components/schemas/AdminMutationReasonCode'}\n        note: {type: ['string', 'null'], minLength: 1, maxLength: 1000}\n",
    "    AdminServiceZoneCreateRequest:\n      type: object\n      additionalProperties: false\n      required: [patch, reasonCode]\n      properties:\n        expectedVersion: {type: ['integer', 'null'], minimum: 1}\n        patch: {type: object, minProperties: 1}\n        reasonCode: {$ref: '#/components/schemas/AdminMutationReasonCode'}\n        note: {type: ['string', 'null'], minLength: 1, maxLength: 1000}\n    AdminServiceZoneUpdateRequest:\n      type: object\n      additionalProperties: false\n      required: [expectedVersion, patch, reasonCode]\n      properties:\n        expectedVersion: {type: integer, minimum: 1}\n        patch: {type: object, minProperties: 1}\n        reasonCode: {$ref: '#/components/schemas/AdminMutationReasonCode'}\n        note: {type: ['string', 'null'], minLength: 1, maxLength: 1000}\n    AdminServiceZonePincodeCreateRequest:\n      type: object\n      additionalProperties: false\n      required: [pincode, priority, isPrimary, isActive, reasonCode]\n      properties:\n        expectedVersion: {type: ['integer', 'null'], minimum: 1}\n        pincode: {type: string, pattern: '^[1-9][0-9]{5}$'}\n        priority: {type: integer, minimum: 1}\n        isPrimary: {type: boolean}\n        isActive: {type: boolean}\n        reasonCode: {$ref: '#/components/schemas/AdminMutationReasonCode'}\n        note: {type: ['string', 'null'], minLength: 1, maxLength: 1000}\n    AdminServiceZonePincodeUpdateRequest:\n      type: object\n      additionalProperties: false\n      required: [expectedVersion, pincode, priority, isPrimary, isActive, reasonCode]\n      properties:\n        expectedVersion: {type: integer, minimum: 1}\n        pincode: {type: string, pattern: '^[1-9][0-9]{5}$'}\n        priority: {type: integer, minimum: 1}\n        isPrimary: {type: boolean}\n        isActive: {type: boolean}\n        reasonCode: {$ref: '#/components/schemas/AdminMutationReasonCode'}\n        note: {type: ['string', 'null'], minLength: 1, maxLength: 1000}\n",
)
replace_once(
    openapi,
    "        content: {application/json: {schema: {$ref: '#/components/schemas/AdminServiceZoneUpdateRequest'}}}\n      responses:\n        '200': {description: Zone created or safely replayed, content: {application/json: {schema: {$ref: '#/components/schemas/FlexibleRecordResponse'}}}}\n        '400': {$ref: '#/components/responses/BadRequest'}\n        '401': {$ref: '#/components/responses/Unauthorized'}\n        '403': {$ref: '#/components/responses/Forbidden'}\n        '409': {$ref: '#/components/responses/Conflict'}\n",
    "        content: {application/json: {schema: {$ref: '#/components/schemas/AdminServiceZoneCreateRequest'}}}\n      responses:\n        '200': {description: Zone created or safely replayed, content: {application/json: {schema: {$ref: '#/components/schemas/FlexibleRecordResponse'}}}}\n        '400': {$ref: '#/components/responses/BadRequest'}\n        '401': {$ref: '#/components/responses/Unauthorized'}\n        '403': {$ref: '#/components/responses/Forbidden'}\n        '404': {$ref: '#/components/responses/NotFound'}\n        '409': {$ref: '#/components/responses/Conflict'}\n",
)
replace_once(
    openapi,
    "        content: {application/json: {schema: {$ref: '#/components/schemas/AdminServiceZonePincodeUpdateRequest'}}}\n      responses:\n        '200': {description: Pincode route created or safely replayed, content: {application/json: {schema: {$ref: '#/components/schemas/FlexibleRecordResponse'}}}}\n        '400': {$ref: '#/components/responses/BadRequest'}\n        '401': {$ref: '#/components/responses/Unauthorized'}\n        '403': {$ref: '#/components/responses/Forbidden'}\n        '409': {$ref: '#/components/responses/Conflict'}\n",
    "        content: {application/json: {schema: {$ref: '#/components/schemas/AdminServiceZonePincodeCreateRequest'}}}\n      responses:\n        '200': {description: Pincode route created or safely replayed, content: {application/json: {schema: {$ref: '#/components/schemas/FlexibleRecordResponse'}}}}\n        '400': {$ref: '#/components/responses/BadRequest'}\n        '401': {$ref: '#/components/responses/Unauthorized'}\n        '403': {$ref: '#/components/responses/Forbidden'}\n        '404': {$ref: '#/components/responses/NotFound'}\n        '409': {$ref: '#/components/responses/Conflict'}\n",
)

# Database integrity, least privilege and deterministic report freshness.
migration = "supabase/migrations/20260728113000_phase_2e_city_activation.sql"
replace_once(
    migration,
    "  created_at timestamptz not null default now(),\n  constraint city_activation_reports_checks_object",
    "  created_at timestamptz not null default clock_timestamp(),\n  constraint city_activation_reports_checks_object",
)
replace_once(
    migration,
    "create index city_activation_reports_city_created_idx\n  on private.city_activation_reports(city_id, created_at desc);\n",
    "create index city_activation_reports_city_created_idx\n  on private.city_activation_reports(city_id, created_at desc, id desc);\n\ncreate table private.merchant_branch_activation_history (\n  id bigint generated always as identity primary key,\n  branch_id uuid not null references public.merchant_branches(id) on update cascade on delete restrict,\n  city_id uuid not null references public.cities(id) on update cascade on delete restrict,\n  from_status public.merchant_branch_status not null,\n  to_status public.merchant_branch_status not null,\n  actor_id uuid not null references public.profiles(id) on update cascade on delete restrict,\n  request_id text,\n  idempotency_key uuid not null,\n  activated_at timestamptz not null default clock_timestamp(),\n  constraint merchant_branch_activation_history_transition check (\n    from_status = 'APPROVED' and to_status = 'ACTIVE'\n  ),\n  constraint merchant_branch_activation_history_command_unique unique (branch_id, idempotency_key)\n);\n\ncreate index merchant_branch_activation_history_city_created_idx\n  on private.merchant_branch_activation_history(city_id, activated_at desc, id desc);\n",
)
replace_once(
    migration,
    "alter table private.city_activation_reports enable row level security;\nalter table private.city_activation_reports force row level security;\n",
    "alter table private.city_activation_reports enable row level security;\nalter table private.city_activation_reports force row level security;\nalter table private.merchant_branch_activation_history enable row level security;\nalter table private.merchant_branch_activation_history force row level security;\n",
)
replace_once(
    migration,
    "revoke all on private.city_activation_reports from public, anon, authenticated;\ngrant select, insert on private.city_configuration_versions to service_role;\n",
    "revoke all on private.city_activation_reports from public, anon, authenticated;\nrevoke all on private.merchant_branch_activation_history from public, anon, authenticated;\ngrant select, insert on private.city_configuration_versions to service_role;\n",
)
replace_once(
    migration,
    "grant select, insert on private.city_activation_reports to service_role;\n",
    "grant select, insert on private.city_activation_reports to service_role;\ngrant select, insert on private.merchant_branch_activation_history to service_role;\n",
)
replace_once(
    migration,
    "drop trigger if exists city_activation_readiness_set_updated_at\n  on private.city_activation_readiness;\n",
    "drop trigger if exists prevent_merchant_branch_activation_history_mutation\n  on private.merchant_branch_activation_history;\ncreate trigger prevent_merchant_branch_activation_history_mutation\nbefore update or delete on private.merchant_branch_activation_history\nfor each row execute function private.prevent_append_only_mutation();\n\ndrop trigger if exists city_activation_readiness_set_updated_at\n  on private.city_activation_readiness;\n",
)
replace_once(
    migration,
    "        where aca.admin_user_id = p_actor_id\n          and aca.city_id = c.id\n          and aca.revoked_at is null\n",
    "        where aca.admin_user_id = p_actor_id\n          and aca.city_id = c.id\n          and aca.role = 'CITY_ADMIN'\n          and aca.revoked_at is null\n",
)
replace_once(
    migration,
    "      order by report.created_at desc\n      limit 1",
    "      order by report.created_at desc, report.id desc\n      limit 1",
)
replace_once(
    migration,
    "    order by created_at desc\n    limit 1;",
    "    order by created_at desc, id desc\n    limit 1;",
)
replace_once(
    migration,
    "    raise exception 'ADMIN_CITY_TRANSITION_INVALID';\n  end;\n  if v_target not in ('ACTIVE', 'PAUSED') then raise exception 'ADMIN_CITY_TRANSITION_INVALID'; end if;",
    "    raise exception 'ADMIN_CITY_TRANSITION_TARGET_INVALID';\n  end;\n  if v_target not in ('ACTIVE', 'PAUSED') then raise exception 'ADMIN_CITY_TRANSITION_TARGET_INVALID'; end if;",
)
replace_once(
    migration,
    "    if v_before.status <> 'ACTIVE' then raise exception 'ADMIN_CITY_TRANSITION_INVALID'; end if;",
    "    if v_before.status <> 'ACTIVE' then raise exception 'ADMIN_CITY_TRANSITION_STATE_CONFLICT'; end if;",
)
replace_once(
    migration,
    "      raise exception 'ADMIN_CITY_TRANSITION_INVALID';\n    end if;\n    select version into v_config_version",
    "      raise exception 'ADMIN_CITY_TRANSITION_STATE_CONFLICT';\n    end if;\n    select version into v_config_version",
)
replace_once(
    migration,
    "    update public.merchant_branches mb\n    set status = 'ACTIVE', updated_by = p_actor_id\n    from public.shops shop, public.merchant_profiles merchant, public.profiles merchant_profile\n    where mb.city_id = p_city_id\n      and mb.status = 'APPROVED'\n      and mb.verification_status = 'VERIFIED'\n      and mb.geography_status = 'VERIFIED'\n      and mb.local_delivery_enabled\n      and shop.id = mb.shop_id\n      and shop.deleted_at is null\n      and shop.verification_status = 'VERIFIED'\n      and shop.operational_status not in ('PAUSED', 'SUSPENDED')\n      and merchant.user_id = mb.merchant_id\n      and merchant.kyc_status = 'VERIFIED'\n      and merchant.onboarding_status = 'ACTIVE'\n      and merchant_profile.id = mb.merchant_id\n      and merchant_profile.status = 'ACTIVE';\n",
    "    with activated_branches as (\n      update public.merchant_branches mb\n      set status = 'ACTIVE', updated_by = p_actor_id\n      from public.shops shop, public.merchant_profiles merchant, public.profiles merchant_profile\n      where mb.city_id = p_city_id\n        and mb.status = 'APPROVED'\n        and mb.verification_status = 'VERIFIED'\n        and mb.geography_status = 'VERIFIED'\n        and mb.local_delivery_enabled\n        and shop.id = mb.shop_id\n        and shop.deleted_at is null\n        and shop.verification_status = 'VERIFIED'\n        and shop.operational_status not in ('PAUSED', 'SUSPENDED')\n        and merchant.user_id = mb.merchant_id\n        and merchant.kyc_status = 'VERIFIED'\n        and merchant.onboarding_status = 'ACTIVE'\n        and merchant_profile.id = mb.merchant_id\n        and merchant_profile.status = 'ACTIVE'\n      returning mb.id, mb.city_id\n    )\n    insert into private.merchant_branch_activation_history(\n      branch_id,\n      city_id,\n      from_status,\n      to_status,\n      actor_id,\n      request_id,\n      idempotency_key,\n      activated_at\n    )\n    select\n      branch.id,\n      branch.city_id,\n      'APPROVED',\n      'ACTIVE',\n      p_actor_id,\n      nullif(btrim(p_request_id), ''),\n      p_idempotency_key,\n      clock_timestamp()\n    from activated_branches branch;\n",
)

# pgTAP regressions.
test = "supabase/tests/0103_phase_2e_city_activation.test.sql"
replace_once(test, "select plan(39);", "select plan(49);")
replace_once(
    test,
    "select ok(\n  to_regclass('private.city_activation_reports') is not null,\n  'immutable city activation reports exist'\n);\n",
    "select ok(\n  to_regclass('private.city_activation_reports') is not null,\n  'immutable city activation reports exist'\n);\nselect ok(\n  to_regclass('private.merchant_branch_activation_history') is not null,\n  'branch-level city activation history exists'\n);\n",
)
replace_exact_count(
    test,
    "        'city_activation_reports'\n      )",
    "        'city_activation_reports',\n        'merchant_branch_activation_history'\n      )",
    2,
)
replace_exact_count(
    test,
    "  3,\n  'every Phase 2E evidence table",
    "  4,\n  'every Phase 2E evidence table",
    2,
)
replace_once(
    test,
    "select is(\n  has_function_privilege(\n    'service_role',\n    'public.admin_update_city_configuration(uuid,uuid,integer,jsonb,text,text,text,uuid)',\n    'EXECUTE'\n  ),\n  true,\n  'the trusted backend may invoke city configuration commands'\n);\n",
    "select is(\n  has_function_privilege(\n    'service_role',\n    'public.admin_update_city_configuration(uuid,uuid,integer,jsonb,text,text,text,uuid)',\n    'EXECUTE'\n  ),\n  true,\n  'the trusted backend may invoke city configuration commands'\n);\n\nset local role authenticated;\nselect throws_ok(\n  $$ select count(*) from private.city_configuration_versions $$,\n  '42501',\n  null,\n  'authenticated clients cannot read city configuration evidence'\n);\nselect throws_ok(\n  $$ select count(*) from private.city_activation_readiness $$,\n  '42501',\n  null,\n  'authenticated clients cannot read city readiness evidence'\n);\nselect throws_ok(\n  $$ select count(*) from private.city_activation_reports $$,\n  '42501',\n  null,\n  'authenticated clients cannot read city activation reports'\n);\nselect throws_ok(\n  $$ select count(*) from private.merchant_branch_activation_history $$,\n  '42501',\n  null,\n  'authenticated clients cannot read branch activation history'\n);\nreset role;\n",
)
replace_once(
    test,
    "  ('e3000000-0000-4000-8000-000000000001', 'P2E-GLOBAL', 'PLATFORM', true, true),\n  ('e3000000-0000-4000-8000-000000000002', 'P2E-CITY', 'OPERATIONS', true, false);\n",
    "  ('e3000000-0000-4000-8000-000000000001', 'P2E-GLOBAL', 'PLATFORM', true, true),\n  ('e3000000-0000-4000-8000-000000000002', 'P2E-CITY', 'OPERATIONS', true, false);\n\ninsert into auth.users (\n  id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at\n) values\n  (\n    'e3000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',\n    'phase2e-support@example.test', crypt('local-test-only', gen_salt('bf')), now(),\n    '{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb, '{}'::jsonb, now(), now()\n  ),\n  (\n    'e3000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',\n    'phase2e-merchant@example.test', crypt('local-test-only', gen_salt('bf')), now(),\n    '{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb, '{}'::jsonb, now(), now()\n  );\ninsert into public.profiles (id, account_type, full_name, status) values\n  ('e3000000-0000-4000-8000-000000000004', 'ADMIN', 'Phase 2E Support', 'ACTIVE'),\n  ('e3000000-0000-4000-8000-000000000005', 'MERCHANT', 'Phase 2E Merchant', 'ACTIVE');\ninsert into public.admin_profiles (user_id, employee_code, department, two_factor_enabled, has_global_access)\nvalues ('e3000000-0000-4000-8000-000000000004', 'P2E-SUPPORT', 'SUPPORT', true, false);\ninsert into public.merchant_profiles (user_id, legal_name, onboarding_status, kyc_status)\nvalues ('e3000000-0000-4000-8000-000000000005', 'Phase 2E Merchant Legal', 'ACTIVE', 'VERIFIED');\n",
)
replace_once(
    test,
    "values (\n  'e3200000-0000-4000-8000-000000000001',\n  'e3000000-0000-4000-8000-000000000002',\n  'e3100000-0000-4000-8000-000000000001',\n  'CITY_ADMIN',\n  'e3000000-0000-4000-8000-000000000001',\n  'Phase 2E test assignment'\n);\n",
    "values (\n  'e3200000-0000-4000-8000-000000000001',\n  'e3000000-0000-4000-8000-000000000002',\n  'e3100000-0000-4000-8000-000000000001',\n  'CITY_ADMIN',\n  'e3000000-0000-4000-8000-000000000001',\n  'Phase 2E test assignment'\n);\ninsert into public.admin_city_assignments (\n  id, admin_user_id, city_id, role, assigned_by, reason\n) values (\n  'e3200000-0000-4000-8000-000000000002',\n  'e3000000-0000-4000-8000-000000000004',\n  'e3100000-0000-4000-8000-000000000001',\n  'SUPPORT_AGENT',\n  'e3000000-0000-4000-8000-000000000001',\n  'Phase 2E support-only assignment'\n);\n",
)
replace_once(
    test,
    "update public.cities\nset status = 'READY_FOR_VALIDATION'\nwhere id = 'e3100000-0000-4000-8000-000000000001';\n\nselect is(\n",
    "update public.cities\nset status = 'READY_FOR_VALIDATION'\nwhere id = 'e3100000-0000-4000-8000-000000000001';\n\nselect throws_ok(\n  $$\n    select public.admin_transition_city(\n      'e3000000-0000-4000-8000-000000000001',\n      'e3100000-0000-4000-8000-000000000001',\n      'DRAFT',\n      'OPERATIONAL_RECOVERY',\n      'Unsupported target',\n      'phase2e-request-target-invalid',\n      'e3800000-0000-4000-8000-000000000010'\n    )\n  $$,\n  'P0001',\n  'ADMIN_CITY_TRANSITION_TARGET_INVALID',\n  'unsupported transition targets are rejected as invalid input'\n);\nselect throws_ok(\n  $$\n    select public.admin_transition_city(\n      'e3000000-0000-4000-8000-000000000001',\n      'e3100000-0000-4000-8000-000000000001',\n      'PAUSED',\n      'OPERATIONAL_RECOVERY',\n      'Illegal state transition',\n      'phase2e-request-state-conflict',\n      'e3800000-0000-4000-8000-000000000011'\n    )\n  $$,\n  'P0001',\n  'ADMIN_CITY_TRANSITION_STATE_CONFLICT',\n  'illegal lifecycle transitions are state conflicts'\n);\n\nselect is(\n",
)
replace_once(
    test,
    "    ) -> 'controlPlane' -> 'zones' -> 0 ->> 'id'\n",
    "    ) -> 'controlPlane' -> 'zones' -> 0 -> 'zone' ->> 'id'\n",
)
replace_once(
    test,
    "  'new pincode mappings use deterministic idempotent identities'\n);\nselect throws_ok(\n",
    "  'new pincode mappings use deterministic idempotent identities'\n);\n\ninsert into public.addresses (\n  id, user_id, label, recipient_name, phone_number, line1, area, city, state, postal_code, country_code, location\n) values (\n  'e3c00000-0000-4000-8000-000000000001',\n  'e3000000-0000-4000-8000-000000000005',\n  'Phase 2E Branch', 'Phase 2E Merchant', '9000000005', '5 Test Road', 'Central',\n  'Tirupati', 'Andhra Pradesh', '517501', 'IN',\n  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography\n);\ninsert into public.shops (\n  id, merchant_id, address_id, shop_code, name, slug, phone_number, location,\n  verification_status, operational_status, accepts_online_orders\n) values (\n  'e3d00000-0000-4000-8000-000000000001',\n  'e3000000-0000-4000-8000-000000000005',\n  'e3c00000-0000-4000-8000-000000000001',\n  'P2E-SHOP', 'Phase 2E Shop', 'phase-2e-shop', '9100000005',\n  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,\n  'VERIFIED', 'OPEN', true\n);\ninsert into public.merchant_branches (\n  id, shop_id, merchant_id, city_id, primary_service_zone_id, branch_code, name, branch_type,\n  address_id, return_address_id, pincode, location, local_delivery_enabled,\n  postal_delivery_enabled, all_india_postal_enabled, accepts_walk_in\n) values (\n  'e3e00000-0000-4000-8000-000000000001',\n  'e3d00000-0000-4000-8000-000000000001',\n  'e3000000-0000-4000-8000-000000000005',\n  'e3100000-0000-4000-8000-000000000001',\n  'e3400000-0000-4000-8000-000000000001',\n  'P2E-BRANCH', 'Phase 2E Branch', 'PHYSICAL_STORE',\n  'e3c00000-0000-4000-8000-000000000001',\n  'e3c00000-0000-4000-8000-000000000001',\n  '517501', 'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,\n  true, false, false, true\n);\nupdate public.merchant_branches\nset verification_status = 'VERIFIED', geography_status = 'VERIFIED', status = 'VERIFICATION_PENDING'\nwhere id = 'e3e00000-0000-4000-8000-000000000001';\nupdate public.merchant_branches\nset status = 'APPROVED'\nwhere id = 'e3e00000-0000-4000-8000-000000000001';\n\nselect throws_ok(\n",
)
replace_once(
    test,
    "  'city activation activates validation-ready service zones atomically'\n);\nselect is(\n  (\n    public.admin_transition_city(\n",
    "  'city activation activates validation-ready service zones atomically'\n);\nselect is(\n  (\n    select count(*)::integer\n    from private.merchant_branch_activation_history\n    where branch_id = 'e3e00000-0000-4000-8000-000000000001'\n      and idempotency_key = 'e3800000-0000-4000-8000-000000000002'\n  ),\n  1,\n  'city activation records one immutable history row per activated branch'\n);\nselect ok(\n  exists (\n    select 1\n    from private.merchant_branch_activation_history\n    where branch_id = 'e3e00000-0000-4000-8000-000000000001'\n      and from_status = 'APPROVED'\n      and to_status = 'ACTIVE'\n      and actor_id = 'e3000000-0000-4000-8000-000000000001'\n      and activated_at is not null\n  ),\n  'branch activation history retains transition, actor and timestamp'\n);\nselect is(\n  (\n    public.admin_transition_city(\n",
)
replace_once(
    test,
    "select is(\n  (\n    select count(*)::integer\n    from public.list_admin_cities('e3000000-0000-4000-8000-000000000002')\n  ),\n  1,\n  'a scoped administrator lists only the assigned city'\n);\n",
    "select is(\n  (\n    select count(*)::integer\n    from public.list_admin_cities('e3000000-0000-4000-8000-000000000002')\n  ),\n  1,\n  'a scoped administrator lists only the assigned city'\n);\nselect is(\n  (\n    select count(*)::integer\n    from public.list_admin_cities('e3000000-0000-4000-8000-000000000004')\n  ),\n  0,\n  'support-only assignments cannot read the city activation control plane'\n);\n",
)

Path("docs/implementation/phase-2e-merge-blockers-bug-fix.md").write_text(
    """# Bug-Fix Task

## Observed behavior

PR #169 implemented Phase 2E, but CI run #1296 failed in the database lane. The pgTAP assertion read the service-zone wrapper using the wrong JSON path, and activation reports created inside one transaction shared `now()` timestamps, making the latest report nondeterministic. Seven review threads also identified lifecycle error conflation, OpenAPI create/update drift, over-broad city-list scope, missing branch activation history, unexercised RLS isolation, non-modal dialog handling, and missing create-route 404 contracts.

## Expected behavior

Database tests execute every planned assertion deterministically. Invalid target values map to input rejection, illegal lifecycle states map to conflict, only global administrators and `CITY_ADMIN` assignments can read the control plane, every bulk-activated branch receives immutable same-transaction history, authenticated clients cannot read private evidence tables, the confirmation dialog uses native modal semantics, and OpenAPI distinguishes create requests from versioned updates while documenting not-found responses.

## Reproduction

1. Check out PR #169 at `f557f6399ab6a1bbb167ebd381edb2eaf0da6ce0`.
2. Run `pnpm db:test`.
3. Observe assertion 18 returning `NULL` from `zones[0].id`, followed by `ADMIN_CITY_PREFLIGHT_REQUIRED` and a bad 39-test plan ending at 28 assertions.
4. Inspect the seven unresolved CodeRabbit threads on PR #169.

## Evidence

- Logs: GitHub Actions CI run #1296, `Database and OpenAPI` job.
- Request ID: Not applicable; repository verification failure.
- Order ID: Not applicable.
- Screenshot: Playwright evidence passed and is unrelated to the database failure.
- Environment: GitHub-hosted Ubuntu 24.04, Node.js 20.20.2, pnpm 8.15.0, Supabase CLI 2.109.1.
- App version: PR #169 head `f557f6399ab6a1bbb167ebd381edb2eaf0da6ce0`.

## Constraints

- Reproduce before changing code.
- Add a failing regression test first where practical.
- Fix the root cause, not only the visible symptom.
- Preserve unrelated behavior.
- Run relevant full workflow tests.
- Document data-repair needs separately.

## Data repair

No production data repair is required because this migration has not been merged. If equivalent SQL was applied to an external environment, backfill branch activation history from city audit entries and branch timestamps before enforcing history completeness.
"""
)

required = {
    page: ["showModal()", "addEventListener('cancel'", "requestClose"],
    gateway: ["ADMIN_CITY_TRANSITION_STATE_CONFLICT", "ADMIN_CITY_TRANSITION_TARGET_INVALID"],
    openapi: ["AdminServiceZoneCreateRequest", "AdminServiceZonePincodeCreateRequest"],
    migration: ["merchant_branch_activation_history", "clock_timestamp()", "aca.role = 'CITY_ADMIN'"],
    test: ["select plan(49);", "support-only assignments", "branch activation history retains"],
}
for file, needles in required.items():
    content = Path(file).read_text()
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{file}: missing expected repair marker {needle!r}")
