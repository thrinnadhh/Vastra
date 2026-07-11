Prepare a plan for Sprint 0, then implement one approved ticket at a time.

Sprint 0 objective:

- Create the TypeScript monorepo foundation.
- Establish consistent tooling, tests, CI, environment validation, and documentation checks.
- Do not implement product features.

Expected architecture:

```text
apps/customer-app
apps/merchant-app
apps/captain-app
apps/admin-dashboard
apps/backend
packages/api-client
packages/domain-types
packages/validation
packages/design-tokens
packages/config
packages/testing
supabase/migrations
supabase/tests
```

Required outcomes:

- pnpm workspace
- Turborepo or equivalent workspace orchestration
- TypeScript strict mode
- ESLint and formatting
- Environment schema validation
- Shared test configuration
- Standard root scripts:
  - lint
  - typecheck
  - test
  - test:integration
  - db:test
  - openapi:check
  - build
- OpenAPI validation
- Secret-safe `.env.example` files
- GitHub Actions checks
- No real secrets
- All empty apps can start/build with placeholder health screens only

First return an ordered ticket plan. Do not implement all of Sprint 0 in one uncontrolled change.
