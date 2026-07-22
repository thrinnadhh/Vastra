import type { CustomerAddress } from './customer-address.types';

export function resolveAddressAfterDeletion(
  addressesInApiOrder: readonly CustomerAddress[],
  serverDefaultAddressId: string | null,
  mode: 'MANAGE' | 'CHECKOUT',
): string | null {
  const eligible = (address: CustomerAddress): boolean =>
    mode === 'MANAGE' || address.serviceability === 'SERVICEABLE';

  if (serverDefaultAddressId !== null) {
    const serverDefault = addressesInApiOrder.find(
      (address) => address.id === serverDefaultAddressId && eligible(address),
    );
    if (serverDefault !== undefined) return serverDefault.id;
  }

  return addressesInApiOrder.find(eligible)?.id ?? null;
}
