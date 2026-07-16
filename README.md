# Vastra

Vastra is a hyperlocal fashion-commerce platform connecting customers, local clothing merchants,
and delivery captains. The MVP is a TypeScript monorepo with Expo mobile applications, a Next.js
admin dashboard, a NestJS modular backend, and Supabase PostgreSQL/Auth/Storage/Realtime.

## Repository status

The backend and database currently cover authentication and authorization, merchant catalogue and
inventory, customer discovery/cart/COD ordering, merchant fulfilment, dispatch initiation, and the
private Wardrobe/Saved Looks MVP. The customer, merchant, captain, and admin interfaces are still
being implemented ticket by ticket; this repository must not yet be treated as pilot-ready.

The frozen product boundary is documented in
[`docs/product/mvp-scope.md`](docs/product/mvp-scope.md). Do not add AI body scanning, virtual
try-on, multi-shop carts, or other post-MVP features without an approved scope change.

## Architecture

```text
Customer / Merchant / Captain apps ─┐
Admin dashboard ─────────────────────┼── NestJS API ── Supabase PostgreSQL
                                    │              ├─ Supabase Auth
                                    │              ├─ Supabase Storage
                                    │              └─ Supabase Realtime
                                    └── FCM, payments, maps and SMS providers
```

| Area | Technology |
| --- | --- |
| Mobile | Expo + React Native |
| Admin | Next.js |
| Backend | NestJS modular monolith |
| Database and auth | Supabase PostgreSQL, RLS and Auth |
| API contract | OpenAPI 3.1 |
| Tests | Vitest, Jest, Supertest and pgTAP |
| Workspace | pnpm + Turborepo |

Critical writes use database transactions, row locks, immutable history, idempotency receipts, and
transactional outbox events. Money is stored as integer paise and timestamps are UTC.

## Prerequisites

- Node.js 24 LTS
- pnpm 8.15.0 through Corepack
- Docker Desktop or another Docker-compatible runtime
- Supabase CLI 2.109.1

```bash
corepack enable
pnpm install --frozen-lockfile
```

Copy only the sanitized templates required by the application you are running:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/customer-app/.env.example apps/customer-app/.env
```

Replace placeholders with local or development credentials. Never commit `.env` files, Supabase
service-role keys, payment secrets, SMS keys, Firebase private keys, or customer data.

## Local development

Start Supabase before running backend workflows that access the database:

```bash
supabase start
supabase db reset --local
pnpm --filter @vastra/backend start:dev
```

Run an application in a separate terminal:

```bash
pnpm --filter @vastra/customer-app start
pnpm --filter @vastra/merchant-app start
pnpm --filter @vastra/captain-app start
pnpm --filter @vastra/admin-dashboard dev
```

The local backend contract is served below `http://localhost:8080/v1`. Health is available at
`GET /v1/health`.

## API contract and generated client

[`docs/api/openapi.yaml`](docs/api/openapi.yaml) is the canonical HTTP contract. Shared TypeScript
types and the client are generated into `packages/api-client`:

```bash
pnpm api:generate
pnpm api:check
pnpm openapi:check
```

Commit the generated schema whenever the OpenAPI contract changes. Application code should import
the shared client rather than manually duplicating endpoint types.

## Verification

Run narrow tests while developing, followed by the applicable repository checks:

```bash
pnpm format:check
pnpm env:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm db:test
pnpm openapi:check
pnpm api:check
pnpm security:audit
pnpm build
```

Database tests reset only the local Supabase stack. Never run reset commands against staging or
production.

## Source-of-truth order

1. `AGENTS.md` and the nearest nested instruction file
2. `docs/architecture/security-model.md`
3. `docs/product/mvp-scope.md`
4. `docs/product/business-rules.md`
5. `docs/workflows/order-state-machine.md`
6. `docs/api/openapi.yaml`
7. `supabase/migrations/`

`Vastra_Supabase_SQL_and_Env_Pack/` and the PDFs under `database/` are historical reference
artifacts. New database work must be implemented as ordered files in `supabase/migrations/` with
matching tests in `supabase/tests/`.

## Security

- Client applications receive only Supabase publishable keys.
- Privileged writes go through the backend and service-role credentials remain server-side.
- Exposed tables require RLS and isolation tests.
- CI runs dependency auditing and committed-secret scanning.
- See [`SECURITY.md`](SECURITY.md) for responsible vulnerability reporting.

## Documentation

Start at [`docs/README.md`](docs/README.md). Product requirements, workflows, database design,
security rules, OpenAPI, acceptance tests, and the release checklist live under `docs/`.
