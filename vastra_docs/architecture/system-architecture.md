---
project: Vastra
version: 1.0
status: Frozen MVP
last_updated: 2026-07-11
---

# System Architecture

## 1. Overview

```text
Customer App ─────┐
Merchant App ─────┼── API Gateway / Backend ── Supabase PostgreSQL
Captain App ──────┤                           ├─ Supabase Auth
Admin Web ────────┘                           ├─ Supabase Storage
                                              └─ Supabase Realtime

External services:
- Firebase Cloud Messaging
- Payment provider
- Maps/navigation provider
- SMS/OTP provider
- Monitoring and error tracking
```

## 2. Architecture style

Use a modular monolith for the MVP.

Modules:

- Auth
- Profiles
- Shops
- Catalogue
- Inventory
- Cart
- Checkout
- Orders
- Payments
- Merchant Alerts
- Dispatch
- Delivery
- Returns
- Refunds
- Notifications
- Support
- Finance
- Admin
- Audit

Each module owns:

- Controller
- Service
- Repository
- DTOs
- Validators
- Authorization
- Events
- Tests

## 3. Monorepo

```text
apps/
  customer-app/
  merchant-app/
  captain-app/
  admin-dashboard/
  backend/

packages/
  api-client/
  domain-types/
  validation/
  design-tokens/
  ui-mobile/
  ui-web/
  analytics/
  config/
  testing/

supabase/
  migrations/
  seed.sql
  functions/
  tests/

docs/
scripts/
.github/workflows/
```

## 4. Technology choices

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo |
| Admin | Next.js |
| Backend | NestJS or Express with TypeScript |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Background push | Firebase Cloud Messaging |
| Validation | Zod |
| API contract | OpenAPI |
| Testing | Vitest/Jest, Supertest, Playwright |
| CI/CD | GitHub Actions |
| Monitoring | Sentry + structured logs |

## 5. Data access boundary

### Direct Supabase usage allowed for

- Authentication
- Public catalogue reads under RLS
- Own profile reads
- Realtime subscriptions
- Signed uploads
- Own notifications

### Backend required for

- Orders
- Payments
- Inventory writes
- Offline sales
- Merchant fulfilment
- Dispatch
- Delivery completion
- Refunds
- Settlements
- Admin actions

## 6. Transaction pattern

Critical write:

```text
Validate request
→ Authorize actor
→ Start database transaction
→ Lock required rows
→ Validate state
→ Apply changes
→ Write immutable history
→ Write outbox event
→ Commit
→ Process notifications asynchronously
```

## 7. Outbox pattern

Use an `outbox_events` table for reliable post-commit events.

Fields:

- id
- event_type
- aggregate_type
- aggregate_id
- payload
- status
- attempt_count
- available_at
- processed_at
- created_at

Examples:

- order.created
- merchant.order.alert
- order.status.changed
- captain.assignment.created
- refund.created

## 8. Environments

Separate projects and credentials:

- Development
- Staging
- Production

Never use production credentials locally.

## 9. Scaling path

### MVP

- One backend deployment
- Supabase PostgreSQL
- Supabase Realtime
- FCM
- Scheduled/background worker

### Later

- Redis for dispatch, queues, and hot location state
- Search engine for catalogue
- Dedicated recommendation service
- Dedicated media/AI processing
- Read replicas and partitioning
