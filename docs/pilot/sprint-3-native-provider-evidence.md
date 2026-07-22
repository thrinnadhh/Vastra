# Sprint 3 native and provider evidence

Status: `NOT_RUN`

This runbook closes the evidence-planning gap without claiming provider, emulator, or physical-device results. Record concrete artifacts only after executing every relevant step with approved non-production credentials and the release device matrix.

## Preconditions

- Customer Supabase project URL and publishable key configured in the approved local environment.
- Backend API base URL reachable from the device or emulator.
- SMS OTP provider enabled for approved test phone numbers.
- At least one active customer account with an incomplete profile and one with a completed profile.
- One customer-owned order UUID and one order UUID owned by another customer.
- Android and iOS entries from `docs/pilot/device-matrix.md` available.
- No service-role key, provider secret, OTP, phone number, invite token, or access token included in screenshots or logs.

## Launch commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @vastra/customer-app android
pnpm --filter @vastra/customer-app ios
```

Use native development builds when validating scheme registration; Expo web and provider-free browser fixtures are not accepted as native evidence.

## Evidence matrix

| ID | Check | Required evidence | Status |
|---|---|---|---|
| S3-NATIVE-01 | First launch shows welcome once | Screen recording plus app-storage reset steps | NOT_RUN |
| S3-NATIVE-02 | Live phone OTP request and verification | Redacted recording; provider delivery timestamp; no OTP in logs | NOT_RUN |
| S3-NATIVE-03 | Wrong, expired, resend-cooldown, and rate-limit OTP recovery | Redacted recordings and provider/test configuration | NOT_RUN |
| S3-NATIVE-04 | Supabase session survives app restart and refresh | Restart recording and redacted auth lifecycle logs | NOT_RUN |
| S3-NATIVE-05 | Incomplete customer is forced through profile setup | Recording plus API response showing `profileCompleted: true` after save | NOT_RUN |
| S3-NATIVE-06 | GPS enabled + granted permission reaches server-confirmed serviceability | Recording and redacted request ID | NOT_RUN |
| S3-NATIVE-07 | Retryable permission denial retains manual fallback | Recording on Android and iOS | NOT_RUN |
| S3-NATIVE-08 | Permanently blocked permission exposes native app settings | Recording showing settings navigation and manual fallback | NOT_RUN |
| S3-NATIVE-09 | GPS disabled exposes truthful recovery | Recording on Android and iOS | NOT_RUN |
| S3-NATIVE-10 | Manual coordinates are validated and do not create an address | Recording plus before/after address query evidence | NOT_RUN |
| S3-NATIVE-11 | Cold-start `vastra://order/{ownedOrderId}` opens owned order detail | Recording plus redacted request ID | NOT_RUN |
| S3-NATIVE-12 | Foreground order link opens and Back restores Orders tab | Recording | NOT_RUN |
| S3-NATIVE-13 | Another customer's order link fails without existence leakage | Recording and response status/code, with UUID redacted | NOT_RUN |
| S3-NATIVE-14 | Invalid and wrong-application links show generic recovery | Recordings for invalid UUID, merchant scheme, and captain scheme | NOT_RUN |
| S3-NATIVE-15 | Product/shop/look links enter canonical typed routes | Recording after owning feature branches are integrated | NOT_RUN |
| S3-NATIVE-16 | Session expiry during protected navigation reauthenticates safely | Recording and redacted lifecycle logs | NOT_RUN |

## Suggested native link commands

Replace placeholders locally; never commit real identifiers.

```bash
npx uri-scheme open "vastra://order/00000000-0000-4000-8000-000000000000" --android
npx uri-scheme open "vastra://order/00000000-0000-4000-8000-000000000000" --ios
npx uri-scheme open "vastra://order/not-a-uuid" --android
npx uri-scheme open "vastra-merchant://order/00000000-0000-4000-8000-000000000000" --ios
```

## Evidence storage

Store redacted evidence under an approved Sprint 11 evidence path. Each record must include:

- evidence ID;
- UTC timestamp;
- app commit SHA;
- backend commit SHA;
- platform, OS version, device/emulator model;
- environment label;
- tester;
- outcome: `PASS`, `FAIL`, or `BLOCKED`;
- artifact path and checksum;
- defects or follow-up issue numbers.

Do not change this document's overall status to passed based only on unit tests, Playwright fixtures, Expo web, mocked providers, or screenshots without reproducible metadata.
