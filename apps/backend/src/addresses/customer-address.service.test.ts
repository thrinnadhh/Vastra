import type { SupabaseClient } from '../auth/supabase-client.type';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { CustomerAddressGateway } from './customer-address.gateway';
import { CustomerAddressNotFoundError } from './customer-address.gateway';
import { CustomerAddressService } from './customer-address.service';

const ID = '10000000-0000-4000-8000-000000000001';
const KEY = '20000000-0000-4000-8000-000000000001';
const ADDRESS = {
  id: ID,
  label: 'Home',
  recipientName: 'Customer',
  phoneNumber: '9000000001',
  line1: '1 Main Road',
  line2: null,
  landmark: null,
  area: 'Tirupati',
  city: 'Tirupati',
  state: 'Andhra Pradesh',
  postalCode: '517501',
  countryCode: 'IN',
  latitude: 13.6,
  longitude: 79.4,
  isDefault: true,
  serviceable: true,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
} as const;
const context = {
  actor: { id: ID, email: null, accountType: 'CUSTOMER', status: 'ACTIVE' },
  accessToken: 'token',
  supabase: {} as SupabaseClient,
} as AuthenticatedRequestContext;
function gateway(): CustomerAddressGateway {
  return {
    list: vi.fn(() => Promise.resolve([ADDRESS])),
    create: vi.fn(() => Promise.resolve(ADDRESS)),
    get: vi.fn(() => Promise.resolve(ADDRESS)),
    update: vi.fn(() => Promise.resolve(ADDRESS)),
    remove: vi.fn(() => Promise.resolve({ deletedAddressId: ID, defaultAddressId: null })),
    setDefault: vi.fn(() => Promise.resolve(ADDRESS)),
  };
}

describe('CustomerAddressService', () => {
  it('does not accept a caller-controlled customer identity', async () => {
    const provider = gateway();
    const createAddress = vi.spyOn(provider, 'create');
    const service = new CustomerAddressService(provider);
    await expect(
      service.create(context, { ...ADDRESS, userId: 'other' }, KEY),
    ).rejects.toMatchObject({ status: 400 });
    expect(createAddress).not.toHaveBeenCalled();
  });
  it('validates coordinates and fields before calling the gateway', async () => {
    const provider = gateway();
    const service = new CustomerAddressService(provider);
    await expect(
      service.create(
        context,
        {
          ...ADDRESS,
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          serviceable: undefined,
          latitude: 91,
        },
        KEY,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('maps ownership-safe not found errors', async () => {
    const provider = gateway();
    provider.get = vi.fn(() => Promise.reject(new CustomerAddressNotFoundError()));
    await expect(new CustomerAddressService(provider).get(context, ID)).rejects.toMatchObject({
      status: 404,
    });
  });
});
