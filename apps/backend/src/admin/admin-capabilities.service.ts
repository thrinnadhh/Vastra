import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  AdminCapabilitiesGatewayUnavailableError,
  type AdminCapabilitiesGateway,
} from './admin-capabilities.gateway';
import type { GetAdminCapabilitiesResponse } from './admin-capabilities.types';
import { createAdminReadProviderUnavailableException } from './admin-http-error';
import { ADMIN_CAPABILITIES_GATEWAY } from './admin.tokens';

@Injectable()
export class AdminCapabilitiesService {
  public constructor(
    @Inject(ADMIN_CAPABILITIES_GATEWAY)
    private readonly gateway: AdminCapabilitiesGateway,
  ) {}

  public async get(context: AuthenticatedRequestContext): Promise<GetAdminCapabilitiesResponse> {
    try {
      return {
        success: true,
        data: {
          assuranceLevel: context.assuranceLevel ?? 'aal1',
          permissions: await this.gateway.listGrantedPermissions(context.supabase),
          mfaRequiredForSensitiveOperations: true,
        },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      if (error instanceof AdminCapabilitiesGatewayUnavailableError) {
        throw createAdminReadProviderUnavailableException();
      }
      throw error;
    }
  }
}
