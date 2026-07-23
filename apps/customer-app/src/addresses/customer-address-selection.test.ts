import { CUSTOMER_ADDRESS_FIXTURE } from './customer-address.fixtures';
import { resolveAddressAfterDeletion } from './customer-address-selection';

const SECOND = {
  ...CUSTOMER_ADDRESS_FIXTURE,
  id: '22222222-2222-4222-8222-222222222222',
  label: 'Office',
  isDefault: false,
};

const UNSERVICEABLE = {
  ...SECOND,
  id: '33333333-3333-4333-8333-333333333333',
  serviceability: 'UNSERVICEABLE' as const,
};

describe('resolveAddressAfterDeletion', () => {
  it('uses the server-returned default when eligible', () => {
    expect(
      resolveAddressAfterDeletion(
        [SECOND, CUSTOMER_ADDRESS_FIXTURE],
        CUSTOMER_ADDRESS_FIXTURE.id,
        'CHECKOUT',
      ),
    ).toBe(CUSTOMER_ADDRESS_FIXTURE.id);
  });

  it('falls back to the first eligible address in API order', () => {
    expect(resolveAddressAfterDeletion([UNSERVICEABLE, SECOND], null, 'CHECKOUT')).toBe(SECOND.id);
  });

  it('does not silently select an unserviceable checkout address', () => {
    expect(resolveAddressAfterDeletion([UNSERVICEABLE], UNSERVICEABLE.id, 'CHECKOUT')).toBeNull();
    expect(resolveAddressAfterDeletion([UNSERVICEABLE], UNSERVICEABLE.id, 'MANAGE')).toBe(
      UNSERVICEABLE.id,
    );
  });
});
