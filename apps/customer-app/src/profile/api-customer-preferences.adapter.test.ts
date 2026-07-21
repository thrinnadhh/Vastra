import type { ApiClient } from '@vastra/api-client';

import { ApiCustomerPreferencesAdapter } from './api-customer-preferences.adapter';

const PREFERENCES = {
  genderCategories: ['WOMEN'] as const,
  styleTags: ['casual'],
  occasionTags: ['work'],
  preferredColours: ['#112233'],
  preferredSizes: ['M'],
  minPricePaise: 50_000,
  maxPricePaise: 200_000,
  updatedAt: '2026-07-21T00:00:00.000Z',
};

const createClient = (): { readonly apiClient: ApiClient; readonly request: jest.Mock } => {
  const request = jest
    .fn()
    .mockResolvedValueOnce({
      data: { success: true, data: { preferences: PREFERENCES }, meta: { requestId: null } },
      status: 200,
      requestId: 'request-load',
    })
    .mockResolvedValueOnce({
      data: { success: true, data: { preferences: PREFERENCES }, meta: { requestId: null } },
      status: 200,
      requestId: 'request-save',
    });

  return { apiClient: { request }, request };
};

describe('ApiCustomerPreferencesAdapter', () => {
  it('loads and replaces preferences through generated operation IDs', async () => {
    const { apiClient, request } = createClient();
    const adapter = new ApiCustomerPreferencesAdapter(apiClient);

    await expect(adapter.load()).resolves.toEqual({ kind: 'READY', preferences: PREFERENCES });
    await expect(
      adapter.save({
        genderCategories: ['WOMEN'],
        styleTags: ['casual'],
        occasionTags: ['work'],
        preferredColours: ['#112233'],
        preferredSizes: ['M'],
        minPricePaise: 50_000,
        maxPricePaise: 200_000,
      }),
    ).resolves.toEqual({ kind: 'SAVED', preferences: PREFERENCES });

    expect(request).toHaveBeenNthCalledWith(1, 'getCustomerPreferences', {});
    expect(request).toHaveBeenNthCalledWith(2, 'replaceCustomerPreferences', {
      body: {
        genderCategories: ['WOMEN'],
        styleTags: ['casual'],
        occasionTags: ['work'],
        preferredColours: ['#112233'],
        preferredSizes: ['M'],
        minPricePaise: 50_000,
        maxPricePaise: 200_000,
      },
    });
  });

  it('keeps load and save failures recoverable', async () => {
    const request = jest.fn().mockRejectedValue(new Error('offline'));
    const adapter = new ApiCustomerPreferencesAdapter({ request });

    await expect(adapter.load()).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(
      adapter.save({
        genderCategories: [],
        styleTags: [],
        occasionTags: [],
        preferredColours: [],
        preferredSizes: [],
        minPricePaise: null,
        maxPricePaise: null,
      }),
    ).resolves.toEqual({ kind: 'UNAVAILABLE' });
  });
});
