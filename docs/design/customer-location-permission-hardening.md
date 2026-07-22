# Customer location permission hardening

Ticket follow-up: `FE-S03-04`

## Purpose

Close the native permission-state gap without changing serviceability, address, or product scope.

## Behavior

- `DENIED` means the operating system can still show the permission prompt again.
- `BLOCKED` means the operating system reports `canAskAgain: false`.
- A denied customer receives retry and manual-coordinate recovery.
- A blocked customer receives an explicit application-settings action and the same manual fallback.
- Neither path reads coordinates until permission is granted.
- Manual coordinates continue to be checked by the server and never create or update an address.

## Platform adapter

The Expo adapter maps `PermissionResponse.status` together with `canAskAgain`; status alone is not sufficient to distinguish a retryable denial from a permanently blocked permission. Native settings are opened through React Native `Linking.openSettings()`.

## Evidence boundary

Automated tests verify permission mapping, settings invocation, UI recovery, and absence of coordinate reads. Actual Android and iOS settings screens remain physical-device or emulator release evidence and must not be inferred from unit tests.
