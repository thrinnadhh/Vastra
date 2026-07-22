import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerAddressAdapter } from './api-customer-address.adapter';

const API_ADDRESS = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Home',
  recipientName: 'Customer',
  phoneNumber: '+919000000001',
  line1: '12 Temple Road',
  line2: null,
  landmark: null,
  area: 'Tiruchanur',
  city: 'Tirupati',
  state: 'Andhra Pradesh',
  postalCode: '517501',
  countryCode: 'IN' as const,
  latitude: 13.6288,
  longitude: 79.4192,
  isDefault: true,
  serviceable: true,
  createdAt: '2026-07-22T10:00:00.000Z',
  updatedAt: '2026-07-22T10:00:00.000Z',
};

const INPUT = {
  label: 'Home',
  recipientName: 'Customer',
  phoneNumber: '+919000000001',
  line1: '12 Temple Road',
  line2: null,
  landmark: null,
  area: 'Tiruchanur',
  city: 'Tirupati',
  state: 'Andhra Pradesh',
  postalCode: '517501',
  countryCode: 'IN' as const,
  latitude: 13.6288,
  longitude: 79.4192,
  isDefault: true,
};

function createApiClient(request: jest.Mock): ApiClient {
  return { request };
}

describe('ApiCustomerAddressAdapter', () => {
  it('maps server-owned ids, default state and serviceability', async () => {
    const request = jest.fn().mockResolvedValue({
      data: { success: true, data: { addresses: [API_ADDRESS] }, meta: { requestId: null } },
    });
    const adapter = new ApiCustomerAddressAdapter(createApiClient(request));

    await expect(adapter.list()).resolves.toEqual({
      kind: 'SUCCESS',
      addresses: [
        expect.objectContaining({
          id: API_ADDRESS.id,
          isDefault: true,
          serviceability: 'SERVICEABLE',
        }),
      ],
    });
    expect(request).toHaveBeenCalledWith('listCustomerAddresses', {});
  });

  it('uses generated mutation operations with a stable idempotency key', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ data: { data: { address: API_ADDRESS } } })
      .mockResolvedValueOnce({ data: { data: { address: API_ADDRESS } } })
      .mockResolvedValueOnce({
        data: { data: { deletedAddressId: API_ADDRESS.id, defaultAddressId: null } },
      })
      .mockResolvedValueOnce({ data: { data: { address: API_ADDRESS } } });
    const adapter = new ApiCustomerAddressAdapter(createApiClient(request));
    const key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    await adapter.create(INPUT, key);
    await adapter.update(API_ADDRESS.id, INPUT, key);
    await adapter.remove(API_ADDRESS.id, key);
    await adapter.setDefault(API_ADDRESS.id, key);

    expect(request.mock.calls).toEqual([
      [
        'createCustomerAddress',
        { headers: { 'Idempotency-Key': key }, body: INPUT },
        {
          allowedFieldErrors: [
            'label',
            'recipientName',
            'phoneNumber',
            'line1',
            'line2',
            'landmark',
            'area',
            'city',
            'state',
            'postalCode',
            'latitude',
            'longitude',
            'isDefault',
          ],
        },
      ],
      [
        'updateCustomerAddress',
        { path: { addressId: API_ADDRESS.id }, headers: { 'Idempotency-Key': key }, body: INPUT },
        {
          allowedFieldErrors: [
            'label',
            'recipientName',
            'phoneNumber',
            'line1',
            'line2',
            'landmark',
            'area',
            'city',
            'state',
            'postalCode',
            'latitude',
            'longitude',
            'isDefault',
          ],
        },
      ],
      [
        'deleteCustomerAddress',
        { path: { addressId: API_ADDRESS.id }, headers: { 'Idempotency-Key': key } },
      ],
      [
        'setCustomerDefaultAddress',
        { path: { addressId: API_ADDRESS.id }, headers: { 'Idempotency-Key': key } },
      ],
    ]);
  });

  it('preserves allow-listed server validation errors', async () => {
    const adapter = new ApiCustomerAddressAdapter(
      createApiClient(
        jest.fn().mockRejectedValue({
          normalized: {
            kind: 'VALIDATION',
            fieldErrors: { postalCode: ['Postal code is outside the pilot area.'], secret: ['no'] },
          },
        }),
      ),
    );

    await expect(adapter.create(INPUT, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).resolves.toEqual({
      kind: 'FAILURE',
      failureKind: 'VALIDATION',
      fieldErrors: { postalCode: 'Postal code is outside the pilot area.' },
      requiresRefresh: false,
    });
  });

  it.each([
    ['TRANSPORT', 'OFFLINE'],
    ['AUTHENTICATION', 'SESSION_EXPIRED'],
    ['AUTHORIZATION', 'UNAUTHORIZED'],
  ] as const)('classifies %s without rendering raw backend errors', async (kind, failureKind) => {
    const adapter = new ApiCustomerAddressAdapter(
      createApiClient(jest.fn().mockRejectedValue({ normalized: { kind } })),
    );
    await expect(adapter.list()).resolves.toMatchObject({ kind: 'FAILURE', failureKind });
  });
});
