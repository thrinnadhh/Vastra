import type { ApiClient } from '@vastra/api-client';

import type {
  CustomerPreferenceDraft,
  CustomerPreferencesPort,
} from './customer-profile-preferences.types';

export class ApiCustomerPreferencesAdapter implements CustomerPreferencesPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async load(): Promise<CustomerPreferenceDraft> {
    const response = await this.apiClient.request('getCustomerPreferences', {});
    const preferences = response.data.data.preferences;

    return {
      genderCategories: preferences.genderCategories,
      preferredColours: preferences.preferredColours,
      preferredSizes: preferences.preferredSizes,
      minPricePaise: preferences.minPricePaise,
      maxPricePaise: preferences.maxPricePaise,
    };
  }

  public async save(draft: CustomerPreferenceDraft): Promise<void> {
    await this.apiClient.request('replaceCustomerPreferences', {
      body: {
        genderCategories: draft.genderCategories,
        styleTags: [],
        occasionTags: [],
        preferredColours: draft.preferredColours,
        preferredSizes: draft.preferredSizes,
        minPricePaise: draft.minPricePaise,
        maxPricePaise: draft.maxPricePaise,
      },
    });
  }
}
