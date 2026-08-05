# Merchant barcode end-to-end implementation

Status: implementation and deployment repair
Date: 2026-08-05

## Implemented flow

1. The merchant app resolves the authenticated merchant's owned shop.
2. The merchant scans an EAN-13, EAN-8, UPC-A, UPC-E, Code 128, or QR value using `expo-camera`, or enters the value manually.
3. Online lookup uses the owner-scoped inventory barcode endpoint and caches the authoritative variant and balance snapshot.
4. When connectivity is unavailable, the app can use the last synchronized barcode snapshot.
5. A physical-shop sale is submitted through the existing idempotent offline-sale endpoint. The mobile app never mutates stock directly.
6. Retryable failures are durably queued in AsyncStorage with the original idempotency key. The cached balance is reduced locally to prevent repeated device-side overselling.
7. Queued commands synchronize on application activation, periodically while the inventory workspace is mounted, or through `Sync now`.
8. Permanent failures remain visible with attempt/error information and can be removed by the merchant after review.
9. The same camera scanner is available from each unverified order-packing line and submits the scanned value directly to durable packing verification.

## Security and correctness

- Cross-shop barcode values resolve as not found rather than leaking ownership or producing a server-state error.
- Scanner callbacks use an immediate ref lock to suppress duplicate frame detections.
- Offline commands retain a stable UUID idempotency key across retries.
- Stock changes remain server-authoritative through `create_merchant_offline_sale`.
- Packing RPCs are executable only by `service_role`; `anon` and `authenticated` cannot call them directly.
- The emergency remote deployment is ledger-aligned by `20260805093333_merchant_order_packing.sql`; the functional source remains the historical `20260716033000` migration.

## Verification

The focused merchant verification completed on Node.js 20.20.2 and pnpm 8.15.0:

- generated and built `@vastra/api-client` successfully;
- merchant ESLint passed with zero warnings;
- merchant TypeScript validation passed;
- 23 merchant Jest suites passed, covering 86 tests.

Automated coverage owns:

- merchant inventory API parsing, authentication, lookup, and idempotency headers;
- durable queue deduplication, retry preservation, successful removal, and merchant discard;
- online barcode lookup and physical-sale recording;
- cached offline lookup and durable sale queueing;
- camera result delivery into packing verification;
- cross-shop backend barcode lookup returning not found.

A release build must still be tested on a physical Android device because camera behavior cannot be proven by Jest or a web simulator. The device acceptance path is:

`open Inventory -> grant camera -> scan mapped barcode -> verify variant/balance -> disable network -> record sale -> confirm pending queue and optimistic balance -> reconnect -> Sync now -> confirm queue clears and server balance/movement changed -> open PACKING order -> scan ordered item -> confirm VERIFIED`
