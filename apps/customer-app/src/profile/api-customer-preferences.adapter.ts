import type { ApiClient } from '@vastra/api-client';

import type {
  CustomerPreferenceSnapshot,
  CustomerPreferencesLoadResult,
  CustomerPreferencesPort,
  CustomerPreferencesSaveResult,
  ReplaceCustomerPreferencesInput,
} from './customer-profile-preferences.types';

const asSnapshot = (value: CustomerPreferenceSnapshot): CustomerPreferenceSnapshot => value;

export class ApiCustomerPreferencesAdapter implements CustomerPreferencesPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async load(): Promise<CustomerPreferencesLoadResult> {
    try {
      const response = await this.apiClient.request('getCustomerPreferences', {});
      return {
        kind: 'READY',
        preferences: asSnapshot(response.data.data.preferences),
      };
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
  }

  public async save(
    input: ReplaceCustomerPreferencesInput,
  ): Promise<CustomerPreferencesSaveResult> {
    try {
      const response = await this.apiClient.request('replaceCustomerPreferences', {
        body: input,
      });
      return {
        kind: 'SAVED',
        preferences: asSnapshot(response.data.data.preferences),
      };
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
  }
}
