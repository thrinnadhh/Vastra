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
