# Phase 2E repair failure

Run: 30370803442
Head: e1893e67f3580f32ef68ba1b76e934ee08080a70

## phase2e-apply.log
```text
supabase/migrations/20260728113000_phase_2e_city_activation.sql: expected exactly one match, found 0: '        where aca.admin_user_id = p_actor_id\n          and aca.city_id = c.id\n          and aca.revoked_at is null\n'
```
## Working tree
```text
 M .github/phase2e-repair-failure.md
 M apps/admin-dashboard/src/app/cities/page.tsx
 M apps/backend/src/admin/admin-city.gateway.test.ts
 M apps/backend/src/admin/admin-city.gateway.ts
 M docs/api/openapi.yaml
 M supabase/migrations/20260728113000_phase_2e_city_activation.sql
```
