from pathlib import Path

path = Path('.github/scripts/phase2e_repair.py')
text = path.read_text()
old = "        where aca.admin_user_id = p_actor_id\\n          and aca.city_id = c.id\\n          and aca.revoked_at is null\\n"
new = "       where aca.admin_user_id = p_actor_id\\n         and aca.city_id = c.id\\n         and aca.revoked_at is null\\n"
if text.count(old) != 1:
    raise SystemExit(f'bootstrap expected one scope-predicate patch target, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
