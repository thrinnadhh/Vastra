---
ticket: FE-S07-BACKEND-DEPLOYMENT-AUDIT
sprint: FE-S07
status: deployment-blocked
audited_repository_commit: 87d8fdb483e570ac5323c1b9f94620f64e5095f5
audited_supabase_project: smwvsugpsaiahvxgptxg
audited_at: 2026-07-25
---

# FE-S07 backend deployment audit

## Decision

The repository implementation for the pilot-critical captain forward-COD journey is code-complete and CI-complete. The connected Supabase project is not schema-compatible with that implementation.

FE-S07 is therefore:

- `READY` at the repository/OpenAPI/backend-test boundary;
- `DEPLOYMENT-GAP` at the connected database boundary;
- blocked for a real customer → merchant → captain staging transaction until migration parity is restored.

Do not treat missing captain RPCs or lifecycle columns as frontend defects. Do not bypass the backend with direct Supabase table access or client-authored lifecycle transitions.

## Repository coverage

The current repository contains:

- authenticated captain availability and location controllers;
- captain offer, active-delivery, pickup, drop, COD, OTP, problem and release controllers;
- service/gateway validation and stable error mapping;
- OpenAPI operations and generated `@vastra/api-client` request/response types;
- pgTAP tests for availability/location and the complete delivery lifecycle;
- backend HTTP integration tests;
- FE-S07 resilient client composition and tests.

## Connected database findings

The connected project migration history stops at the product migration `20260715150000_customer_product_search`, followed only by the independent security migration `20260725152537_restrict_rls_auto_enable_execution`.

The connected project does not contain the later ordered product migrations required to create a captain delivery:

1. customer COD placement and its authoritative order/history/reservation/outbox effects;
2. merchant queue/decision/packing/item verification/ready-for-pickup effects;
3. trusted forward-dispatch creation;
4. captain availability/current-location readiness;
5. captain offer, assignment, pickup, tracking, exact COD/OTP completion, problem and release lifecycle.

The live schema audit found all of these FE-S07 prerequisites absent.

### Missing captain functions

- `public.set_captain_availability`
- `public.update_captain_current_location`
- `public.list_captain_delivery_offers`
- `public.get_captain_active_delivery`
- `public.get_captain_delivery`
- `public.respond_delivery_offer`
- `public.arrive_delivery_pickup`
- `public.verify_delivery_pickup`
- `public.depart_delivery_pickup`
- `public.arrive_delivery_drop`
- `public.complete_cod_delivery`
- `public.report_delivery_problem`
- `public.release_delivery_task`
- `public.run_delivery_dispatch_cycle`

### Missing durable columns

- `captain_current_locations.recorded_at`
- `captain_current_locations.sample_id`
- `delivery_tasks.arrived_pickup_at`
- `delivery_tasks.pickup_verified_at`
- `delivery_tasks.departed_pickup_at`
- `delivery_tasks.arrived_drop_at`
- `delivery_tasks.pickup_code_expires_at`
- `delivery_tasks.delivery_otp_expires_at`
- `delivery_tasks.pickup_code_attempts`
- `delivery_tasks.delivery_otp_attempts`
- `delivery_tasks.offer_wave_number`
- `delivery_tasks.offer_radius_meters`
- `delivery_tasks.next_offer_wave_at`
- `delivery_tasks.problem_reported_at`

### Missing private structures and indexes

- `private.captain_location_update_receipts`
- `private.captain_dispatch_readiness`
- `private.delivery_command_receipts`
- `delivery_assignments_one_active_captain_idx`
- `delivery_tasks_offer_wave_due_idx`

The project currently contains zero profiles, captains, current locations, orders, delivery tasks, assignments, payments and outbox events. This lowers data-conversion risk but does not remove the requirement to apply and validate migrations in order.

## Required remediation

### 1. Restore ordered migration parity

Apply every unapplied repository migration after `20260715150000_customer_product_search` in timestamp order. Do not cherry-pick only the two Sprint 8 migrations because the captain flow depends on upstream customer COD, merchant fulfilment and dispatch-start functions.

Critical milestones in that ordered chain include:

- `20260715230000_customer_cod_order_placement.sql`;
- merchant order decision and read-model migrations that follow COD placement;
- `20260716033000_merchant_order_packing.sql`;
- `20260716043000_merchant_ready_for_pickup.sql`;
- `20260716053000_order_dispatch_start.sql`;
- all intervening alert/dispatch dependencies;
- `20260717170000_captain_availability_location.sql`;
- `20260717180000_sprint8_delivery_lifecycle.sql`;
- every later repository migration required by current `main`.

Use the repository migration runner or Supabase migration application. Do not reproduce migration SQL manually or edit already-applied migrations.

### 2. Prove database permissions

After migration:

- every captain and delivery mutation RPC must be `SECURITY DEFINER` with a fixed empty search path;
- `PUBLIC`, `anon` and `authenticated` must not have direct execution rights;
- `service_role` must have the required execution rights;
- authenticated clients must not receive direct writes to delivery, location, receipt, COD or earning tables;
- forced RLS must remain enabled.

### 3. Run the complete database verification

Run the repository database suite, including:

- `0046_captain_availability_location.test.sql`;
- `0047_sprint8_delivery_lifecycle.test.sql`;
- customer COD placement tests;
- merchant decision, packing and ready-for-pickup tests;
- dispatch-start and concurrency tests;
- database security and performance advisors.

### 4. Run API/backend verification

Require:

- formatting and lint;
- strict TypeScript;
- backend unit and integration tests;
- OpenAPI validation and generated-client drift check;
- complete workspace build;
- the required `Verify repository` aggregate CI gate.

### 5. Execute staging transaction

Only after schema parity and CI:

`customer COD placement → merchant accept → packing → item verification → ready for pickup → dispatch → captain offer → accept → arrive pickup → pickup code → depart → arrive drop → exact COD + OTP → delivered`

Use the pilot observer and report validators already merged in PR #139. Physical Android and FCM evidence remain separate release gates.

## FE-S07 action classification

| FE-S07 action | Repository | Connected database | Effective status |
|---|---|---|---|
| Restore captain session/role | Ready | Base auth schema present | `READY` |
| Set availability | Ready | RPC/readiness projection absent | `DEPLOYMENT-GAP` |
| Submit location | Ready | RPC/receipt/current-location columns absent | `DEPLOYMENT-GAP` |
| List offers | Ready | offer/dispatch RPCs absent | `DEPLOYMENT-GAP` |
| Accept/reject offer | Ready | response RPC and active-assignment index absent | `DEPLOYMENT-GAP` |
| Read active/task | Ready | captain delivery read RPCs absent | `DEPLOYMENT-GAP` |
| Arrive at merchant | Ready | lifecycle RPC/columns absent | `DEPLOYMENT-GAP` |
| Verify pickup code | Ready | secret expiry/attempt/RPC absent | `DEPLOYMENT-GAP` |
| Depart merchant | Ready | lifecycle RPC/columns absent | `DEPLOYMENT-GAP` |
| Arrive at customer | Ready | lifecycle RPC/columns absent | `DEPLOYMENT-GAP` |
| Exact COD + delivery OTP | Ready | atomic completion RPC/secret fields absent | `DEPLOYMENT-GAP` |
| Release before pickup | Ready | release RPC absent | `DEPLOYMENT-GAP` |
| Report delivery problem | Ready | problem RPC/durable timestamp absent | `DEPLOYMENT-GAP` |

## Exit criteria

The deployment gap is closed only when:

1. connected migration history matches the repository migration chain;
2. every required FE-S07 function, column, private relation and index exists;
3. direct-client permissions remain denied and service-role permissions pass;
4. pgTAP, backend integration, OpenAPI and complete CI pass;
5. one real staging customer → merchant → captain COD journey passes without direct-table workarounds.
