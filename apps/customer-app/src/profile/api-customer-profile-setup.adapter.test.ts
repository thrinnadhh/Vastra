import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerProfileSetupAdapter } from './api-customer-profile-setup.adapter';

const CUSTOMER_ACCOUNT = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'customer@example.test',
  accountType: 'CUSTOMER' as const,
  status: 'ACTIVE' as const,
  profile: {
    fullName: 'Trinadh B',
    phoneNumber: '+919999999999',
    avatarUrl: null,
  },
  roleProfile: {
    kind: 'CUSTOMER' as const,
    dateOfBirth: null,
    genderPreference: null,
    profileCompleted: true,
    defaultAddressId: null,
  },
  scope: { kind: 'CUSTOMER' as const },
};

describe('ApiCustomerProfileSetupAdapter', () => {
  it('saves through the generated profile operation and returns the server name', async () => {
    const request = jest.fn().mockResolvedValue({
      data: { success: true, data: CUSTOMER_ACCOUNT, meta: { requestId: null } },
      status: 200,
      requestId: 'profile-request',
    });
    const adapter = new ApiCustomerProfileSetupAdapter({ request } as ApiClient);

    await expect(adapter.save('Trinadh B')).resolves.toStrictEqual({
      kind: 'SAVED',
      fullName: 'Trinadh B',
    });
    expect(request).toHaveBeenCalledWith('updateCurrentCustomerProfile', {
      body: { fullName: 'Trinadh B' },
    });
  });

  it('keeps transport and malformed responses recoverable', async () => {
    const offline = new ApiCustomerProfileSetupAdapter({
      request: jest.fn().mockRejectedValue(new Error('offline')),
    } as ApiClient);
    const malformed = new ApiCustomerProfileSetupAdapter({
      request: jest.fn().mockResolvedValue({
        data: {
          success: true,
          data: {
            ...CUSTOMER_ACCOUNT,
            roleProfile: { ...CUSTOMER_ACCOUNT.roleProfile, profileCompleted: false },
          },
          meta: { requestId: null },
        },
        status: 200,
        requestId: 'malformed-profile-request',
      }),
    } as ApiClient);

    await expect(offline.save('Trinadh B')).resolves.toStrictEqual({ kind: 'UNAVAILABLE' });
    await expect(malformed.save('Trinadh B')).resolves.toStrictEqual({ kind: 'UNAVAILABLE' });
  });
});
