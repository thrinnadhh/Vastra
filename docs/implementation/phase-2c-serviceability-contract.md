---
title: Phase 2C city-aware serviceability contract
status: implemented
pr: 160
---

# Phase 2C city-aware serviceability contract

## Purpose

Phase 2C resolves a customer location and product variant to an exact fulfilment branch without reserving inventory. The result is an informational, five-minute catalogue quote that checkout must revalidate before creating a branch inventory reservation.

## Public database API

### `resolve_customer_service_area`

Inputs:

- latitude
- longitude
- six-digit Indian pincode

Resolution order:

1. active pincode mapping
2. active city
3. active service zone
4. optional PostGIS zone geofence

The function returns explicit reason codes when the location cannot be served.

### `get_variant_serviceability_quote`

Inputs:

- variant ID
- requested quantity
- latitude
- longitude
- pincode

Local fulfilment requires an active and verified branch, active merchant and shop, active city and zone, branch-zone coverage, sufficient branch inventory after safety stock, and distance inside the configured radius.

Branch selection is deterministic:

1. primary zone assignment
2. shortest distance
3. higher available stock
4. shorter preparation time
5. stable branch ID

When no local branch qualifies, postal fulfilment is evaluated independently using explicit pincode coverage or an all-India branch flag. Postal quotes are prepaid-only and defer courier pricing to checkout.

Local delivery fees are authoritative server calculations:

```text
base delivery fee + ceil(distance metres × per-kilometre fee / 1000)
```

COD eligibility uses the selected city's configured COD limit. Quote creation never changes `reserved_quantity` and never creates an inventory reservation.

### `revalidate_serviceability_quote`

Revalidation rejects quotes when any of these conditions change:

- quote expiry
- request variant or quantity
- branch lifecycle or verification
- merchant or shop eligibility
- city or zone lifecycle
- city configuration version
- branch inventory version or available quantity
- local radius, geofence, pincode or delivery fee
- postal coverage

Stock is reserved only in the later checkout phase.

## Phase boundary

This phase does not change order creation, payment initiation, captain assignment, postal tracking, refunds or settlements. Phase 2D will consume and revalidate this quote before storing immutable order geography and reserving branch inventory.
