import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerProfileGateway,
  CustomerProfileDataInvalidError,
  CustomerProfileGatewayUnavailableError,
  CustomerProfileStateInvalidError,
} from './customer-profile.gateway';
import { CUSTOMER_PROFILE_GATEWAY } from './customer-profile.tokens';
import {
  CustomerProfileValidationError,
  parseUpdateCustomerProfileInput,
} from './customer-profile.validation';
import {
  createCustomerProfileValidationException,
  createMeProviderUnavailableException,
  createProfileStateInvalidException,
} from './me-http-error';
import { MeService } from './me.service';
import type { GetCurrentAccountResponse } from './me.types';

@Injectable()
export class CustomerProfileService {
  public constructor(
    @Inject(CUSTOMER_PROFILE_GATEWAY)
    private readonly gateway: CustomerProfileGateway,
    @Inject(MeService)
    private readonly meService: MeService,
  ) {}

  public async updateCurrentCustomerProfile(
    context: AuthenticatedRequestContext,
    body: unknown,
  ): Promise<GetCurrentAccountResponse> {
    try {
      const input = parseUpdateCustomerProfileInput(body);
      await this.gateway.updateCurrentCustomerProfile(context.supabase, input);
      return await this.meService.getCurrentAccount(context);
    } catch (error: unknown) {
      if (error instanceof CustomerProfileValidationError) {
        throw createCustomerProfileValidationException();
      }

      if (
        error instanceof CustomerProfileStateInvalidError ||
        error instanceof CustomerProfileDataInvalidError
      ) {
        throw createProfileStateInvalidException();
      }

      if (error instanceof CustomerProfileGatewayUnavailableError) {
        throw createMeProviderUnavailableException();
      }

      throw error;
    }
  }
}
