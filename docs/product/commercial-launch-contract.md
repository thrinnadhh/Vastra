---
project: Vastra
contract: commercial-launch
version: 1.0
status: accepted-with-provisional-operating-defaults
approved_by: founder
approved_on: 2026-07-27
launch_target: full-commercial-launch
initial_city: Tirupati
expansion_order:
  - Bengaluru
  - Chittoor
supersedes:
  - product-requirements.md section 4 entries for multiple merchant branches and full multi-city operations
  - product-requirements.md section 5 one-zone, one-shop launch assumptions
---

# Vastra Commercial Launch Contract

## 1. Authority and scope

This document is the controlling founder contract for Vastra's commercial launch and
multi-city operating model.

Where this contract conflicts with the frozen MVP assumptions in
`docs/product/product-requirements.md`, this contract takes precedence for all new
architecture, database, backend, frontend, admin, operations, and release work.

This contract defines product and operating requirements. It does not by itself authorize a
production deployment. Production release still requires verified staging, provider,
physical-device, load, security, recovery, and operational evidence.

Normative terms use the following meanings:

- **MUST**: required for commercial launch.
- **MUST NOT**: prohibited for commercial launch.
- **SHOULD**: expected unless a documented exception is approved by the global owner.
- **MAY**: optional behavior.

## 2. Commercial launch decision

### CL-001 — Launch category

Vastra targets a **full commercial launch**, not a closed technical pilot.

The launch may still use staged geographic activation, but customers and approved merchants
inside an active market receive the real commercial product, real support obligations, real
order processing, and real financial reconciliation.

### CL-002 — Merchant registration

Merchant registration is open to any eligible applicant, including physical stores and cloud
shops.

Open registration does not mean automatic selling activation. A merchant MUST complete the
minimum identity, bank, pickup/return location, catalogue-quality, and operating-readiness
checks before accepting commercial orders.

The merchant lifecycle is:

```text
REGISTERED
→ VERIFICATION_PENDING
→ APPROVED
→ ACTIVE
→ PAUSED | SUSPENDED | CLOSED
```

Only `ACTIVE` merchants and branches may accept orders.

### CL-003 — Initial market sequence

The approved expansion order is:

1. Tirupati
2. Bengaluru
3. Chittoor

The commercial reasons are:

- **Tirupati:** founder home market, easier merchant and operations relationships, and faster
  issue resolution.
- **Bengaluru:** stronger product exposure, diverse customer population, and access to users
  from many cities.
- **Chittoor:** strategic relevance to clothing commerce and proximity to the initial
  operating base.

The architecture MUST NOT hardcode Tirupati as the only supported city.

### CL-004 — City launch speed

After the platform foundation is deployed, an approved city SHOULD be configurable and ready
for controlled commercial activation within **two to three days**, without a city-specific
application release or database redesign.

A city launch may require configuration, merchant onboarding, captain onboarding, and an
operational validation order. It MUST NOT require source-code changes for ordinary city,
pincode, zone, fee, commission, coupon, COD, operating-hour, or employee-assignment changes.

## 3. Market and serviceability model

### CL-005 — Geographic hierarchy

Pincode is the founder-selected commercial routing boundary, but exact local serviceability
MUST also be validated through service zones or geofences.

The canonical hierarchy is:

```text
Country
└── State
    └── City
        └── Service zone / geofence
            └── Pincodes
                └── Merchant branches and cloud fulfilment locations
```

A pincode MAY belong to more than one service zone only when precedence is explicit and
unambiguous.

### CL-006 — City and zone controls

A city and each service zone MUST support independent lifecycle control:

```text
DRAFT
→ CONFIGURING
→ READY_FOR_VALIDATION
→ ACTIVE
→ PAUSED
→ CLOSED
```

The global owner may pause or restore a city or zone without redeploying the applications.

Pausing a city or zone MUST prevent new affected orders while preserving access to existing
orders, support, refunds, returns, audit records, and required completion or recovery flows.

### CL-007 — Customer location behavior

A customer may store addresses in multiple cities.

For local commerce, the platform MUST resolve the customer's current delivery address to:

- country and state;
- city;
- pincode;
- service zone or geofence;
- eligible merchant branches;
- available fulfilment modes.

The customer SHOULD see the eligible branch serving the current address, not an arbitrary
branch belonging to the same merchant.

Customers may browse merchants outside their current city only when those merchants explicitly
enable postal delivery to the customer's pincode.

## 4. Merchant, branch, and cloud-shop model

### CL-008 — Merchant and branch separation

A merchant account may own multiple branches across multiple cities.

The domain model MUST separate:

```text
merchant account
merchant product catalogue
merchant branch or cloud fulfilment location
branch-level inventory
branch-level operating status
branch-level serviceability
```

A branch belongs to one city and one primary service zone. Any additional service zones MUST
be explicitly configured.

### CL-009 — Cloud shops

An eligible user may establish a cloud shop without a public walk-in storefront.

A cloud shop MUST still have:

- a verified responsible person or legal entity;
- a verified pickup and return address;
- an inventory fulfilment location;
- supported pincodes or postal serviceability;
- packaging capability;
- settlement details;
- return and dispute responsibility.

### CL-010 — Catalogue price and branch stock

The same merchant product and variant SHOULD retain one merchant-controlled selling price
across that merchant's branches unless a future founder-approved pricing exception is
introduced.

Stock MUST be branch- or fulfilment-location-specific. One branch's stock MUST NOT be used to
promise another branch's local order unless a documented inter-branch transfer workflow exists.

Every order MUST retain immutable price, fee, commission, discount, tax, and policy snapshots.

There is no founder-imposed maximum catalogue size. Technical limits, moderation controls,
and fair-use protections may still apply.

## 5. Fulfilment modes

### CL-011 — Local delivery

`LOCAL_DELIVERY` is fulfilled from an eligible branch through the Vastra captain network.

Local delivery MUST use city and zone serviceability, branch inventory, captain assignment,
local delivery fees, delivery verification, and local operating policies.

### CL-012 — Postal delivery

A merchant may enable `POSTAL_DELIVERY` for selected products, branches, pincodes, states, or
all India.

Postal delivery MUST be a distinct order and fulfilment workflow. It MUST NOT create a Vastra
captain task.

A postal order requires:

- postal serviceability;
- shipping fee and delivery estimate;
- merchant dispatch deadline;
- carrier and tracking reference;
- shipment status;
- cancellation, return-to-origin, return, and refund rules;
- merchant responsibility for handoff to the carrier.

The initial commercial default is **prepaid-only postal delivery** until postal COD,
remittance, failed-delivery, and return-to-origin reconciliation are separately approved and
implemented.

A merchant's all-India toggle exposes only products and fulfilment locations that have passed
postal configuration validation.

## 6. City commercial configuration

### CL-013 — City configuration

The global admin platform MUST allow authorized users to configure at least:

- city and state;
- city lifecycle status;
- service zones, geofences, and pincodes;
- operating hours and holidays;
- default and maximum local delivery radius;
- default per-kilometre delivery-fee rules;
- minimum or base delivery fee where applicable;
- default COD limit;
- merchant commission rules;
- city coupons and promotion eligibility;
- cancellation and refund policies;
- local and postal fulfilment availability;
- merchant and captain capacity thresholds;
- assigned city operators and their permissions.

### CL-014 — COD limit

The default local COD limit is **₹2,000**.

The global owner may configure a different limit by city, zone, merchant category, merchant,
or risk policy. Any override MUST be auditable.

Postal COD is disabled by default.

### CL-015 — Delivery fees

Local delivery fees MUST support an admin-controlled default rule based on distance in
kilometres.

The effective fee MAY also consider configured base fees, minimum fees, maximum fees,
service-zone overrides, time windows, demand, merchant subsidy, or promotion rules. The final
fee shown at checkout MUST be snapshotted on the order.

### CL-016 — Coupons, commissions, and policies

Coupons are city-scoped by default. A global coupon requires explicit global-owner approval.

Merchant commissions, cancellation rules, refund rules, COD limits, and delivery subsidies
MUST be configurable without source-code changes and MUST be snapshotted on affected orders.

## 7. Administration and operating ownership

### CL-017 — Global owner

The founder is the `GLOBAL_ADMIN` and must have authorized visibility across all cities,
including:

- merchant and branch status;
- products and stock;
- active and historical orders;
- captain availability and assignments;
- payments, refunds, COD, commissions, and settlements;
- customer-support incidents;
- city health and operating controls;
- immutable audit history.

Global access MUST still require strong authentication, AAL2 where required, least-privilege
technical implementation, and immutable auditing. Global ownership does not permit bypassing
security controls.

### CL-018 — Delegated employees and friends

The founder may assign employees or trusted operators to specific cities and functions.

The authorization model MUST support at least:

- `GLOBAL_ADMIN`;
- `CITY_ADMIN`;
- `CITY_OPERATIONS`;
- `MERCHANT_REVIEWER`;
- `CAPTAIN_OPERATIONS`;
- `SUPPORT_AGENT`;
- `FINANCE_AGENT`.

Non-global roles MUST be restricted by assigned city, zone, permission, and action. The global
owner MUST be able to grant, suspend, modify, and revoke assignments without redeploying.

### CL-019 — Initial responsibility assignments

Until named operational owners are registered, the founder remains accountable for:

- global administration;
- city activation decisions;
- COD reconciliation;
- merchant and captain escalations;
- production go/no-go.

The founder and trusted friends may perform merchant onboarding, customer support, and captain
incident response. Before commercial activation, each active city MUST have explicit named
owners recorded for:

- city operations;
- merchant onboarding and quality;
- customer support;
- captain operations;
- finance and COD reconciliation;
- technical incident escalation.

## 8. City activation contract

### CL-020 — Activation is gated

A global-admin toggle may request city activation, but the backend MUST reject activation when
mandatory preflight checks fail.

An activation request MUST validate at least:

- complete city, pincode, zone, fee, COD, commission, cancellation, and refund configuration;
- at least **five approved and active merchants** for the initial market footprint;
- at least one active merchant serving every zone exposed to customers;
- sufficient in-stock catalogue for each exposed category, without imposing a global catalogue
  maximum;
- calculated captain capacity for forecast peak demand;
- a provisional minimum of **five active captains and two standby captains per initial active
  service zone**, unless a documented lower-demand capacity calculation proves a safer number;
- assigned support, operations, and finance owners;
- payment, SMS/OTP, FCM, and observability health where those capabilities are enabled;
- one successful end-to-end validation order against the release candidate;
- no unresolved critical or high-severity release blocker.

The activation preflight MUST produce an auditable report explaining every pass, failure, and
approved override.

### CL-021 — Expansion and stop rules

Expansion is allowed only after operational stability is demonstrated in the currently active
market.

Expansion MUST pause when either condition occurs:

- measurable quality deterioration; or
- negative or unacceptable unit economics.

Before the first production activation, the founder MUST approve numerical thresholds for:

- order success rate;
- merchant acceptance and fulfilment rate;
- on-time delivery rate;
- cancellation rate;
- return/refund rate;
- inventory mismatch rate;
- support response time;
- customer complaint rate;
- contribution margin per order;
- maximum delivery subsidy per order.

Until those values are approved, the release decision remains blocked even when the code is
otherwise deployable.

## 9. Cross-city isolation requirements

### CL-022 — Permanent order market identity

Every order MUST permanently record at least:

- `city_id`;
- `service_zone_id` for local delivery where applicable;
- `merchant_branch_id` or cloud fulfilment location;
- customer delivery pincode and normalized address snapshot;
- `fulfilment_mode`;
- commercial policy snapshots.

For postal orders, the origin city and branch remain recorded even when the destination lies in
another city or state.

### CL-023 — Operational isolation

A failure, pause, overload, configuration error, or employee action in one city SHOULD NOT
unnecessarily disable another city.

The architecture MUST support city-scoped:

- discovery and search;
- merchant and branch visibility;
- captain assignment;
- coupons and fees;
- commissions and policies;
- operational dashboards;
- support queues;
- analytics;
- alerts and incident ownership.

Cross-city access and cross-city fulfilment MUST be explicit rather than accidental.

## 10. Quality and commercial controls

### CL-024 — Quality protection

Merchant growth MUST NOT override product quality and customer protection.

A materially inaccurate listing, counterfeit item, repeated inventory mismatch, unsafe
packaging, or failure to honor approved return/refund rules may result in listing removal,
branch pause, merchant suspension, financial recovery, or closure.

The default liability rule is:

- when the delivered item materially differs from the approved listing, the customer receives
  the applicable refund;
- the responsible merchant bears product-loss and reverse-logistics costs unless an
  investigation proves another party caused the failure;
- repeated violations trigger progressively stronger enforcement.

### CL-025 — No insecure founder bypass

No founder, admin, employee, merchant, captain, support agent, or automated worker may bypass:

- authorization and city scoping;
- inventory consistency;
- idempotency;
- payment verification;
- delivery verification;
- immutable audit requirements;
- secret protection;
- release evidence.

Emergency recovery actions MUST use an approved, authenticated, reason-required, and audited
path.

## 11. Commercial readiness definition

Vastra is commercially production-ready only when all of the following are true against one
immutable release commit:

1. This contract is reflected in database, backend, frontend, admin, and operational behavior.
2. Multi-city and branch-level isolation tests pass.
3. One city can be configured without source-code changes.
4. A simulated second city can be activated, paused, and isolated in staging.
5. Local and postal fulfilment cannot enter each other's invalid states.
6. Real payment, SMS/OTP, FCM, and refund workflows pass for enabled features.
7. Physical Android critical journeys pass.
8. Production-shaped load, query-plan, and post-load invariant checks pass.
9. Monitoring, alerting, rollback, backup/restore, and recovery drills pass.
10. Named product, engineering, operations, support, and finance owners approve launch.
11. The numerical quality and profitability gates in CL-021 are approved and satisfied.

A green CI run is necessary but not sufficient for this status.

## 12. Phase 1 acceptance record

Phase 1 is complete when this contract is merged and the legacy PRD points to it as the
controlling commercial-launch authority.

The following founder decisions are now frozen:

- full commercial launch target;
- open merchant registration with gated selling activation;
- Tirupati → Bengaluru → Chittoor expansion order;
- two-to-three-day city configuration objective;
- pincode-led, geofence-validated serviceability;
- multiple branches and cloud shops;
- branch-level stock with merchant-level catalogue;
- same merchant-product price across branches by default;
- local and all-India postal fulfilment separation;
- city-scoped coupons, fees, commissions, policies, COD, and employees;
- ₹2,000 default local COD limit;
- global founder control with audited, scoped delegation;
- city pause and activation toggles guarded by preflight validation;
- expansion only after operational stability;
- expansion pause on quality or profitability deterioration.

## 13. Provisional defaults requiring later confirmation

The following defaults are approved for architecture and staging implementation but may be
changed through a versioned founder decision before production:

- postal delivery is prepaid-only initially;
- merchants manually record approved carrier and tracking information before a shipping
  aggregator integration exists;
- initial active-zone capacity uses five active plus two standby captains unless forecast-based
  capacity requires more;
- material listing mismatch cost is assigned to the merchant by default;
- city activation requires at least five approved active merchants.

The numerical quality and contribution-margin thresholds in CL-021 remain the principal open
commercial decisions. They MUST be resolved before production go/no-go.

## 14. Change control

Any change to this contract requires:

1. a version increment;
2. a documented founder decision and rationale;
3. identification of affected schema, services, applications, operations, and migrations;
4. updated acceptance tests;
5. explicit treatment of existing cities, merchants, orders, and policies.

Agents and contributors MUST NOT infer contradictory commercial rules from obsolete pilot
fixtures, prompts, tests, or documentation.