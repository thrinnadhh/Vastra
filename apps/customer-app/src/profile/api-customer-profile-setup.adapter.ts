import type { ApiClient } from '@vastra/api-client';

import type {
  CustomerProfileSetupPort,
  CustomerProfileSetupResult,
} from './customer-profile-setup.types';

export class ApiCustomerProfileSetupAdapter implements CustomerProfileSetupPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async save(fullName: string): Promise<CustomerProfileSetupResult> {
    try {
      const response = await this.apiClient.request('updateCurrentCustomerProfile', {
        body: { fullName },
      });
      const account = response.data.data;

      if (
        account.accountType !== 'CUSTOMER' ||
        account.roleProfile.kind !== 'CUSTOMER' ||
        account.roleProfile.profileCompleted !== true ||
        typeof account.profile.fullName !== 'string'
      ) {
        return { kind: 'UNAVAILABLE' };
      }

      return { kind: 'SAVED', fullName: account.profile.fullName };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { readonly code?: unknown }).code === 'VALIDATION_ERROR'
      ) {
        return { kind: 'INVALID' };
      }

      return { kind: 'UNAVAILABLE' };
    }
  }
}
