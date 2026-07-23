# FE-S05-02 customer address experience

## Boundary

The customer application consumes the generated address operations through `ApiCustomerAddressAdapter`. The adapter maps only customer-visible fields and keeps address identifiers, default selection and serviceability server-owned.

## Screens and states

`CustomerAddressesScreen` supports management and checkout-selection modes. It renders loading, empty, offline, stale, authorization and session-expiry states; serviceability is displayed as serviceable, unserviceable, unknown or stale. Checkout selection is disabled unless the latest server response confirms the address is serviceable.

`CustomerAddressFormScreen` supports add and edit flows with accessible labels, field-associated errors, progress semantics, preserved input on recoverable failure and duplicate-submit prevention. One idempotency key is retained across a recoverable retry of the same save attempt.

## Deletion and selection

After deletion, the client applies the backend response in this order:

1. the server-returned default address when it remains eligible;
2. otherwise the first eligible address in the API-defined list order;
3. otherwise no selected address.

A selected/default deletion invalidates dependent quote state. The client never silently selects an unserviceable checkout address.

## Integration contract

`DefaultCustomerAddresses` accepts only a selected server address ID and callbacks for selection change and quote invalidation. FE-S05-04 owns canonical navigation and cart-to-address-to-quote composition.
