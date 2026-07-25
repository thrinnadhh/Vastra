# Vastra pilot execution tooling

Status: implementation complete; real external evidence remains `NOT_RUN`.

These commands execute and validate the remaining Tirupati pilot gates. They do not convert a
check to `PASS` merely because the command exists. Use one approved release commit for every
report, keep tokens and OTPs outside the repository, and preserve only redacted request IDs,
hashes, timings, screenshots, videos, logs, and generated JSON reports.

## 1. Freeze the release

Export the exact commit that is deployed to staging:

```bash
export PILOT_ENVIRONMENT=staging
export PILOT_RELEASE_COMMIT=<40-character-staging-sha>
export PILOT_OPERATOR=<operator-name>
export PILOT_API_BASE_URL=https://<staging-api-host>
```

The observers and load tools refuse the production `api.vastra.in` host. Non-local hosts must
use HTTPS.

## 2. Execute the customer → merchant → captain COD journey

Create one real staging cart, quote, COD order, merchant session, and captain session. Keep the
three access tokens only in environment variables:

```bash
export PILOT_CUSTOMER_TOKEN=<redacted-runtime-token>
export PILOT_MERCHANT_TOKEN=<redacted-runtime-token>
export PILOT_CAPTAIN_TOKEN=<redacted-runtime-token>
export PILOT_ORDER_ID=<staging-order-uuid>
export PILOT_REPORT_PATH=docs/pilot/evidence/reports/staging-cod.json

pnpm pilot:staging:observe
pnpm pilot:execution-report:check --report "$PILOT_REPORT_PATH"
```

While the observer runs, operators perform the actual transaction in the approved customer,
merchant, and captain applications. The observer reads authoritative projections only. It does
not submit decisions, expose pickup codes, expose delivery OTPs, or store API response bodies.
It passes only after all fourteen lifecycle checkpoints are observed, including the customer
seeing the delivered order.

## 3. Execute physical Android and FCM evidence

Copy:

```text
docs/pilot/evidence/templates/device-fcm-report.template.json
```

into `docs/pilot/evidence/reports/device-fcm.json`, replace the release/operator placeholders,
and record the physical device matrix from `docs/pilot/device-matrix.md`.

A valid `PASS` requires:

- at least three physical Android devices;
- low-memory, current-Android, and minimum-supported-Android classes;
- at least two OEMs;
- foreground, background, killed-process, locked-screen, and battery-saver delivery;
- permission denial/restoration, duplicate delivery, acknowledgement retry, and restart recovery;
- captain location and offer-race evidence;
- a redacted FCM provider timeline with monotonic alert-created, provider-accepted,
  device-received, UI-presented, and acknowledged timestamps.

Validate it with:

```bash
pnpm pilot:execution-report:check \
  --report docs/pilot/evidence/reports/device-fcm.json
```

Never commit native push tokens, provider credentials, raw provider message IDs, pickup codes,
delivery OTPs, or complete notification payloads.

## 4. Capture staging-sized query plans

Install PostgreSQL client tools and export the staging database connection only in the runtime
environment:

```bash
export PILOT_DATABASE_URL=<staging-postgres-connection-string>
export PILOT_QUERY_PLAN_REPORT_PATH=docs/pilot/evidence/reports/query-plans.json

pnpm pilot:query-plans
```

The tool refuses to call an empty or toy dataset representative. It blocks until staging has at
least:

- 100 shops;
- 1,000 products;
- 3,000 variants;
- 1,000 orders;
- 100 captains.

It then captures read-only `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans for discovery,
search, customer order reads, merchant queues, captain offers, reservation expiry, and outbox
worker reads. Add indexes only after a captured plan demonstrates a real problem.

## 5. Execute controlled staging load and post-load invariants

Copy `docs/pilot/load-scenario-plan.template.json` to an evidence workspace. Replace its release
commit, operator, mutable staging IDs, and the numeric `collectedAmountPaise` with the exact
authoritative COD total for the completion task.

The template expects runtime values for:

```text
PILOT_LATITUDE
PILOT_LONGITUDE
PILOT_ORDER_ID
PILOT_QUOTE_CART_ID
PILOT_ORDER_CART_ID
PILOT_QUOTE_ID
PILOT_ADDRESS_ID
PILOT_MERCHANT_RACE_ORDER_ID
PILOT_ASSIGNMENT_ID
PILOT_COMPLETION_TASK_ID
PILOT_DELIVERY_OTP
PILOT_OUTBOX_ORDER_ID
```

Run only against isolated staging data:

```bash
export PILOT_ALLOW_STAGING_MUTATIONS=YES
export PILOT_INVARIANT_REPORT_PATH=docs/pilot/evidence/reports/post-load-invariants.json

pnpm pilot:load -- \
  --plan docs/pilot/evidence/reports/load-plan.json \
  --query-plans docs/pilot/evidence/reports/query-plans.json \
  --invariants "$PILOT_INVARIANT_REPORT_PATH" \
  --output docs/pilot/evidence/reports/load-query.json

pnpm pilot:execution-report:check \
  --report docs/pilot/evidence/reports/load-query.json
```

The runner requires the query-plan gate before sending load. After the final HTTP request, it
runs the invariant audit itself and then writes the final report. A `PASS` requires:

- critical-read success rate at least 99.9%;
- critical-command success rate at least 99.5%;
- critical-read p95 at most 750 ms;
- critical-command p95 at most 1,500 ms;
- zero post-load invariant violations.

The invariant audit checks inventory arithmetic, reservation coverage, exclusive captain
assignment, one active task per captain, order/delivery state alignment, terminal history,
completion events, COD collection state, and duplicate delivery-completion outbox events.

## 6. Execute admin recovery drills

Copy:

```text
docs/pilot/evidence/templates/admin-recovery-report.template.json
```

into `docs/pilot/evidence/reports/admin-recovery.json`. Use a staging administrator with AAL2
and the exact least-privilege permissions required for each drill.

Execute and preserve redacted request/audit IDs for:

- order timeline investigation;
- pre-pickup assignment release;
- post-pickup custody resolution;
- pickup/delivery verification lockout reset;
- merchant order pause/restore;
- captain suspension/restore and availability correction;
- support-case open/assign/escalate/resolve;
- COD reconciliation;
- immutable audit history;
- an unauthorised-admin denial control.

The report cannot pass unless `aal` is `AAL2`, every drill passes, evidence/request IDs exist,
and `auditEntriesVerified` is `true`.

## 7. Attach evidence and make the pilot decision

Do not change `docs/pilot/evidence/manifest.json` check statuses before the matching reports are
complete and validated. Add only repository-relative, redacted evidence paths. Then run:

```bash
pnpm pilot:evidence:check
pnpm pilot:go-no-go
```

`pilot:go-no-go` remains blocked until all mandatory checks pass, no blocking defect remains,
the manifest references the exact release commit, and product, engineering, and operations
owners have signed off.
