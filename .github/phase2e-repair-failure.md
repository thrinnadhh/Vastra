# Phase 2E repair failure

Run: 30371757241
Head: a9e0b096791cd65957d4e761586c8ef443793e8e

## phase2e-apply.log
```text
```
## phase2e-backend.log
```text

> @vastra/backend@0.0.0 test /home/runner/work/Vastra/Vastra/apps/backend
> vitest run --exclude '**/*.integration.test.ts' "admin-city.gateway.test.ts"


[1m[46m RUN [49m[22m [36mv3.2.7 [39m[90m/home/runner/work/Vastra/Vastra/apps/backend[39m

 [32m✓[39m src/admin/admin-city.gateway.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 6[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m4 passed[39m[22m[90m (4)[39m
[2m   Start at [22m 15:07:20
[2m   Duration [22m 456ms[2m (transform 87ms, setup 0ms, collect 219ms, tests 6ms, environment 0ms, prepare 66ms)[22m

```
## phase2e-db.log
```text

> vastra@0.0.0 db:test /home/runner/work/Vastra/Vastra
> bash scripts/run-db-tests.sh


--- start database ---
PASS: start database

--- reset database ---
PASS: reset database

--- list migrations ---
PASS: list migrations

--- pgTAP suite ---
ERROR: pgTAP suite failed
--- bounded failure output (last 240 lines) ---
Connecting to local database...
3.36: Pulling from supabase/pg_prove
dcccee43ad5d: Pulling fs layer
06d62d0de6d7: Pulling fs layer
a22cb17b3b93: Pulling fs layer
4f4fb700ef54: Pulling fs layer
4f4fb700ef54: Waiting
dcccee43ad5d: Download complete
a22cb17b3b93: Verifying Checksum
a22cb17b3b93: Download complete
dcccee43ad5d: Pull complete
4f4fb700ef54: Verifying Checksum
4f4fb700ef54: Download complete
06d62d0de6d7: Verifying Checksum
06d62d0de6d7: Download complete
06d62d0de6d7: Pull complete
a22cb17b3b93: Pull complete
4f4fb700ef54: Pull complete
Digest: sha256:eda7c5e68719e9c8287e78c017118407b48df904a51c935f5ab6098b8c0bc6bc
Status: Downloaded newer image for ghcr.io/supabase/pg_prove:3.36
ghcr.io/supabase/pg_prove:3.36
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0001_foundation.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0001_foundation.test.sql ................................ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0002_shared_types.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0002_shared_types.test.sql .............................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0003_profiles_and_roles.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0003_profiles_and_roles.test.sql ........................ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0004_shops_and_addresses.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0004_shops_and_addresses.test.sql ....................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0005_catalogue_and_variants.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0005_catalogue_and_variants.test.sql .................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0006_inventory_foundations.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0006_inventory_foundations.test.sql ..................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0007_orders_and_carts.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0007_orders_and_carts.test.sql .......................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0008_delivery_foundations.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0008_delivery_foundations.test.sql ...................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0009_payments_and_returns.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0009_payments_and_returns.test.sql ...................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0010_finance_foundations.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0010_finance_foundations.test.sql ....................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0011_operations_foundations.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0011_operations_foundations.test.sql .................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0012_rls_and_isolation.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0012_rls_and_isolation.test.sql ......................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0013_admin_mfa.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0013_admin_mfa.test.sql ................................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0013_hardening.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0013_hardening.test.sql ................................. ok
/home/runner/work/Vastra/Vastra/supabase/tests/0014_product_image_management.test.sql .................. ok
/home/runner/work/Vastra/Vastra/supabase/tests/0015_product_variant_management.test.sql ................ ok
/home/runner/work/Vastra/Vastra/supabase/tests/0016_inventory_balance_lookup.test.sql .................. ok
/home/runner/work/Vastra/Vastra/supabase/tests/0017_merchant_inventory_adjustments.test.sql ............ ok
/home/runner/work/Vastra/Vastra/supabase/tests/0018_inventory_barcode_lookup.test.sql .................. ok
/home/runner/work/Vastra/Vastra/supabase/tests/0019_merchant_offline_sales.test.sql .................... ok
/home/runner/work/Vastra/Vastra/supabase/tests/0020_customer_inventory_reservations.test.sql ........... ok
/home/runner/work/Vastra/Vastra/supabase/tests/0021_merchant_low_stock_read_model.test.sql ............. ok
/home/runner/work/Vastra/Vastra/supabase/tests/0022_customer_catalogue_reads.test.sql .................. ok
/home/runner/work/Vastra/Vastra/supabase/tests/0023_serviceable_nearby_shops.test.sql .................. ok
/home/runner/work/Vastra/Vastra/supabase/tests/0024_public_shop_detail.test.sql ........................ ok
/home/runner/work/Vastra/Vastra/supabase/tests/0025_customer_product_search.test.sql ................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0026_customer_favourite_shops_preferences.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0026_customer_favourite_shops_preferences.test.sql ...... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0027_customer_one_shop_cart.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0027_customer_one_shop_cart.test.sql .................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0028_customer_checkout_quotes.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0028_customer_checkout_quotes.test.sql .................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0029_customer_cod_order_placement.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0029_customer_cod_order_placement.test.sql .............. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0030_merchant_order_alerts.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0030_merchant_order_alerts.test.sql ..................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0031_merchant_alert_acknowledgement.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0031_merchant_alert_acknowledgement.test.sql ............ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0032_merchant_order_decision.test.sql:1: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0032_merchant_order_decision.test.sql ................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0033_merchant_order_packing.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0033_merchant_order_packing.test.sql .................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0034_merchant_ready_for_pickup.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0034_merchant_ready_for_pickup.test.sql ................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0035_order_dispatch_start.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0035_order_dispatch_start.test.sql ...................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0036_merchant_alert_delivery_foundation.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0036_merchant_alert_delivery_foundation.test.sql ........ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0036_wardrobe_storage_foundation.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0036_wardrobe_storage_foundation.test.sql ............... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0037_wardrobe_upload_intents.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0037_wardrobe_upload_intents.test.sql ................... ok
/home/runner/work/Vastra/Vastra/supabase/tests/0038_wardrobe_item_creation.test.sql .................... ok
/home/runner/work/Vastra/Vastra/supabase/tests/0039_wardrobe_item_management.test.sql .................. ok
/home/runner/work/Vastra/Vastra/supabase/tests/0040_saved_looks.test.sql ............................... ok
/home/runner/work/Vastra/Vastra/supabase/tests/0041_saved_look_duplication.test.sql .................... ok
/home/runner/work/Vastra/Vastra/supabase/tests/0042_saved_look_resolution.test.sql ..................... ok
/home/runner/work/Vastra/Vastra/supabase/tests/0043_saved_look_cart.test.sql ........................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0044_merchant_alert_reminders_and_expiry.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0044_merchant_alert_reminders_and_expiry.test.sql ....... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0045_merchant_alert_observability.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0045_merchant_alert_observability.test.sql .............. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0046_captain_availability_location.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0046_captain_availability_location.test.sql ............. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0047_sprint8_delivery_lifecycle.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0047_sprint8_delivery_lifecycle.test.sql ................ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0048_sprint9_admin_audit_foundation.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0048_sprint9_admin_audit_foundation.test.sql ............ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0049_sprint9_admin_dashboard_search.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0049_sprint9_admin_dashboard_search.test.sql ............ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0050_sprint9_admin_order_investigation.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0050_sprint9_admin_order_investigation.test.sql ......... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0051_sprint9_admin_order_operations.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0051_sprint9_admin_order_operations.test.sql ............ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0052_sprint9_admin_merchant_controls.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0052_sprint9_admin_merchant_controls.test.sql ........... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0053_sprint9_admin_captain_controls.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0053_sprint9_admin_captain_controls.test.sql ............ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0054_sprint9_admin_configuration.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0054_sprint9_admin_configuration.test.sql ............... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0055_sprint9_admin_cases.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0055_sprint9_admin_cases.test.sql ....................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0056_sprint9_admin_hardening.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0056_sprint9_admin_hardening.test.sql ................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0057_sprint10_online_payment_initialization.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0057_sprint10_online_payment_initialization.test.sql .... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0058_sprint10_customer_return_request.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0058_sprint10_customer_return_request.test.sql .......... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0059_sprint10_merchant_settlement_eligibility.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0059_sprint10_merchant_settlement_eligibility.test.sql .. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0060_sprint10_payment_webhook_ingestion.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0060_sprint10_payment_webhook_ingestion.test.sql ........ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0061_sprint10_return_evidence_pickup.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0061_sprint10_return_evidence_pickup.test.sql ........... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0062_sprint10_payment_event_processing.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0062_sprint10_payment_event_processing.test.sql ......... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0063_sprint10_merchant_return_inspection.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0063_sprint10_merchant_return_inspection.test.sql ....... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0064_sprint10_captain_finance.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0064_sprint10_captain_finance.test.sql .................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0065_sprint10_admin_return_decision.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0065_sprint10_admin_return_decision.test.sql ............ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0066_sprint10_refund_execution.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0066_sprint10_refund_execution.test.sql ................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0067_sprint10_finance_closure.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0067_sprint10_finance_closure.test.sql .................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0090_sprint10_finance_audit_contracts.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0090_sprint10_finance_audit_contracts.test.sql .......... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0091_customer_profile_update.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0091_customer_profile_update.test.sql ................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0092_customer_address_contract.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0092_customer_address_contract.test.sql ................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0093_customer_order_cancellation.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0093_customer_order_cancellation.test.sql ............... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0093_rls_auto_enable_privileges.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0093_rls_auto_enable_privileges.test.sql ................ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0094_admin_account_approval.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0094_admin_account_approval.test.sql .................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0095_operations_dashboard_lists.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0095_operations_dashboard_lists.test.sql ................ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0096_admin_status_authorization.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0096_admin_status_authorization.test.sql ................ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0097_multi_city_geographic_core.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0097_multi_city_geographic_core.test.sql ................ ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0098_merchant_branches.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0098_merchant_branches.test.sql ......................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0099_branch_inventory.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0099_branch_inventory.test.sql .......................... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0100_city_aware_serviceability.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0100_city_aware_serviceability.test.sql ................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0101_phase_2d_atomic_checkout.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0101_phase_2d_atomic_checkout.test.sql .................. ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0102_phase_2d_checkout_behaviour.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0102_phase_2d_checkout_behaviour.test.sql ............... ok
psql:/home/runner/work/Vastra/Vastra/supabase/tests/0103_phase_2e_city_activation.test.sql:3: NOTICE:  extension "pgtap" already exists, skipping
/home/runner/work/Vastra/Vastra/supabase/tests/0103_phase_2e_city_activation.test.sql .................. 
# Failed test 46: "Phase 2E preserves existing finance audit resource types"
#     died: 42883: function digest(text, unknown) does not exist
#         HINT:       No function matches the given name and argument types. You might need to add explicit type casts.
#         CONTEXT:
#             PL/pgSQL function record_admin_audit(uuid,text,text,uuid,text,text,text,uuid,jsonb,jsonb) line 11 at assignment
#             SQL statement "
#                 select public.record_admin_audit(
#                   'e3000000-0000-4000-8000-000000000001',
#                   'admin.refund.phase2e_regression',
#                   'REFUND',
#                   'e3a00000-0000-4000-8000-000000000001',
#                   'OPERATIONAL_RECOVERY',
#                   'Finance resource remains accepted',
#                   'phase2e-request-finance',
#                   'e3b00000-0000-4000-8000-000000000001',
#                   null,
#                   '{"status":"QUEUED"}'::jsonb
#                 )
#               "
#             PL/pgSQL function lives_ok(text,text) line 14 at EXECUTE
# Looks like you failed 1 test of 49
Failed 1/49 subtests 

Test Summary Report
-------------------
/home/runner/work/Vastra/Vastra/supabase/tests/0103_phase_2e_city_activation.test.sql                (Wstat: 0 Tests: 49 Failed: 1)
  Failed test:  46
Files=84, Tests=1834,  5 wallclock secs ( 0.26 usr  0.13 sys +  0.66 cusr  0.40 csys =  1.45 CPU)
Result: FAIL
[31merror running container: exit 1[39m
Try rerunning the command with --debug to troubleshoot the error.
 ELIFECYCLE  Command failed with exit code 1.
```
## Working tree
```text
 M .github/phase2e-repair-failure.md
 M .github/scripts/phase2e_repair.py
 M apps/admin-dashboard/src/app/cities/page.tsx
 M apps/backend/src/admin/admin-city.gateway.test.ts
 M apps/backend/src/admin/admin-city.gateway.ts
 M docs/api/openapi.yaml
 M supabase/migrations/20260728113000_phase_2e_city_activation.sql
 M supabase/tests/0103_phase_2e_city_activation.test.sql
?? docs/implementation/phase-2e-merge-blockers-bug-fix.md
```
