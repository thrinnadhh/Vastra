---
title: Phase 2D-A atomic branch checkout contract
status: implemented
---

# Phase 2D-A atomic branch checkout contract

## Purpose

Phase 2D-A consumes the Phase 2C serviceability model at cart level. One exact merchant branch must fulfil every line in the existing single-shop cart. The checkout quote is informational and read-only. Order placement revalidates the quote and mutates branch inventory atomically with immutable order creation.

## Stacked rollout

The existing checkout RPCs remain available until Phase 2D-B changes backend consumers. New trusted RPCs are:

- `create_customer_branch_checkout_quote`
- `place_customer_branch_cod_order`
- `prepare_customer_branch_online_payment`
- `attach_customer_branch_payment_session`
- `expire_pending_branch_checkout_orders`

Direct authenticated clients cannot execute the branch mutation RPCs. The NestJS backend uses the service role and remains the public API boundary.

## Quote contract

A version-2 checkout quote stores:

- exact merchant branch, city and service zone;
- local fulfilment mode;
- branch inventory version for every cart line;
- address, branch, geography and commercial snapshots;
- authoritative delivery fee;
- COD eligibility and city COD limit;
- city configuration version;
- five-minute expiry.

Quote creation never reserves inventory, converts a cart, creates an order or calls a payment provider.

## Order contract

A version-2 order freezes:

- branch, city, zone and customer pincode;
- local or future postal fulfilment mode;
- branch pickup/return identity;
- delivery fee, commission, COD limit and policies;
- city configuration version;
- per-line branch inventory version and reservation ID.

These commercial and geographic snapshots cannot be changed after insertion.

## Atomic placement

Both payment methods share one transactional core:

1. lock customer and idempotency receipt;
2. lock quote and active cart;
3. lock cart lines by variant ID;
4. lock selected branch inventory by variant ID;
5. revalidate branch, city, zone, pincode, geofence, price, stock, fee and versions;
6. insert immutable order and order items;
7. release transitional legacy cart reservations;
8. reserve exact branch inventory;
9. convert immediately for COD or hold for online payment;
10. convert the cart and enqueue durable events;
11. commit everything together.

Failure on any line rolls back the complete order and all inventory changes.

## COD

COD is local-delivery-only and requires the final order total to remain inside the quoted city COD limit. Reservations are converted in the placement transaction, so stock on hand decreases exactly once before the order becomes `WAITING_FOR_MERCHANT`.

## Online payment

Online preparation creates a `PAYMENT_PENDING` order, payment row and active branch reservations before provider initialization. Provider HTTP calls remain outside database locks. Attaching the Cashfree session aligns reservation expiry with provider-session expiry.

A verified success event converts active reservations once before activating merchant fulfilment. Verified failure or user-drop events release active reservations and cancel the order. Missing or expired inventory after provider success fails closed for reconciliation rather than silently overselling.

## Expiry lock order

Generic branch-reservation expiry excludes Phase 2D payment-pending orders. The order-aware expiry worker locks order, payment and reservations in that order, releases all active holds, marks the payment failed and cancels the order.

## Scope boundary

Phase 2D-A does not change NestJS gateways, OpenAPI, generated clients or customer screens. That cutover is Phase 2D-B. It also does not add split fulfilment, multi-shop carts, postal pricing, courier tracking, city activation UI or settlement redesign.
